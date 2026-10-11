// The reader at server times (ADR-045, audit #8, from who-said-it): `useSay` plays a phase's lines
// at the server times the view names, once per phase instance, on the device that speaks. Its own
// module: one game uses it, so it rides that game's chunk rather than every phone's entry download.
import { useEffect } from 'react';
import type { SayItem } from '../views';
import { useServerOffset } from './clock';
import { READING_FADE_MS, useSoundApi } from './sound';
import type { SoundApi } from './sound';
import { trace } from './trace';

/** A line more than this late is stale unless it still fits before the deadline. */
const STALE_MS = 1_500;
const FIT_MS = 300;

/** The phase a view's lines belong to (a view's own `phaseId`, `startedAt` and `deadline`). */
export interface SayPhase {
  phaseId: string;
  startedAt: number;
  deadline: number | null;
}

// The bookings live at module level, not in a component: a shell's crossfade hands the old
// component the new view and then unmounts it as the fading ghost, which took its timers with it
// (who-said-it, record-review p20). The newest phase instance any surface has shown, and what it
// has booked or said.
let current = { startedAt: -1, instance: '' };
const booked = new Map<string, ReturnType<typeof setTimeout> | null>();

// A crossfade or StrictMode remount can briefly have no owner in one commit. Retire only
// after the commit, and only if no game surface still owns these bookings. Do not hush here:
// another game's new reading may already be using the same shell sound engine.
let owners = 0;
let retirement: ReturnType<typeof setTimeout> | null = null;
function ownSay(): () => void {
  if (retirement !== null) clearTimeout(retirement);
  retirement = null;
  owners += 1;
  return () => {
    owners = Math.max(0, owners - 1);
    if (owners !== 0) return;
    retirement = setTimeout(() => {
      retirement = null;
      if (owners !== 0) return;
      for (const timer of booked.values()) if (timer !== null) clearTimeout(timer);
      booked.clear();
      current = { startedAt: -1, instance: '' };
    }, 0);
  };
}

/** Starts a phase instance. The last phase's line ducks out (never cut mid-word) and this phase's
 *  lines wait for it: returns that wait in ms, or null for a fading ghost of an older phase. */
function enter(instance: string, startedAt: number, sound: SoundApi): number | null {
  if (startedAt < current.startedAt) return null; // a fading ghost of an older phase
  if (instance === current.instance) return 0;
  const spoke = booked.size > 0;
  for (const timer of booked.values()) if (timer) clearTimeout(timer);
  booked.clear();
  current = { startedAt, instance };
  // The last phase's line never runs on under this one.
  return spoke ? sound.hush(READING_FADE_MS) : 0;
}

/** Books `items` for `phase` at server time `now` (useSay's effect, outside React for tests). */
export function bookSay(
  items: readonly SayItem[],
  phase: SayPhase,
  now: number,
  sound: SoundApi,
): void {
  const instance = `${phase.phaseId}@${phase.startedAt}`;
  const hold = enter(instance, phase.startedAt, sound);
  if (hold === null) return;
  for (const item of items) {
    const id = `${item.key}@${item.at}`;
    if (booked.has(id)) continue;
    const delay = item.at - now;
    const fits = phase.deadline !== null && now + item.ms + FIT_MS < phase.deadline;
    if (delay < -STALE_MS && !fits) {
      booked.set(id, null);
      trace('say', { key: item.key, instance, skipped: 'stale', delay });
      continue;
    }
    // A line due while the last one fades out waits for the fade (hold), so the two never overlap.
    const wait = Math.max(0, delay, hold);
    trace('say', { key: item.key, instance, booked: wait });
    // A line reaches the shell only when due: the shell counts a clip as a cue the moment it is
    // asked for, and a voice booked ahead swallowed the phase's own chime (who-said-it p18).
    const timer = setTimeout(() => {
      booked.set(id, null);
      trace('say', { key: item.key, instance, fired: true });
      sound.clip(item.url, { gain: 1, duck: false });
    }, wait);
    booked.set(id, timer);
  }
}

/**
 * Plays each line at its server time `at`, once per phase instance, on every surface that mounts
 * it. A line that arrives late plays at once if it still ends before the phase does; a stale one
 * (a reload) never. A new phase ducks the last one's line out, and its own lines wait for the fade.
 */
export function useSay(items: readonly SayItem[], phase: SayPhase, on = true): void {
  const sound = useSoundApi();
  const offset = useServerOffset();
  const { phaseId, startedAt, deadline } = phase;
  useEffect(() => (on ? ownSay() : undefined), [on]);
  // Runs on every push (`items` is a new array each time): a line already booked is skipped.
  useEffect(() => {
    if (on) bookSay(items, { phaseId, startedAt, deadline }, Date.now() + offset, sound);
  }, [items, phaseId, startedAt, deadline, on, sound, offset]);
}
