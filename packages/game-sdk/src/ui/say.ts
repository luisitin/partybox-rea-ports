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
// (who-said-it, record-review p20). The newest phase instance any surface has shown, what it has
// booked or said, and how its lines wait out the last phase's fade (see enter).
interface Entered {
  startedAt: number;
  instance: string;
  /** What every line of the phase is pushed back by (ms): the part of the fade its first playable
   *  line is in. Null until a batch has one, since an entering batch can be empty. */
  shift: number | null;
  /** The local time (Date.now) the fade ends: no line of the phase plays before it. Local, not the
   *  server estimate, because hush() measures the fade on this device. */
  fadeEnd: number;
}
const NO_PHASE: Entered = { startedAt: -1, instance: '', shift: null, fadeEnd: 0 };
let current: Entered = NO_PHASE;
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
      current = NO_PHASE;
    }, 0);
  };
}

/** A line more than STALE_MS late is dropped, unless it still fits before the deadline. */
function isStale(item: SayItem, phase: SayPhase, now: number): boolean {
  const fits = phase.deadline !== null && now + item.ms + FIT_MS < phase.deadline;
  return item.at - now < -STALE_MS && !fits;
}

/** Starts a phase instance, or finds it started; null for a fading ghost of an older phase. The last
 *  phase's line ducks out (never cut mid-word), so this phase waits for its fade. */
function enter(instance: string, startedAt: number, sound: SoundApi): Entered | null {
  if (startedAt < current.startedAt) return null; // a fading ghost of an older phase
  if (instance === current.instance) return current;
  const spoke = booked.size > 0;
  // A booking that never fired is traced as cleared, so every booked line is explained.
  for (const [id, timer] of booked) {
    if (!timer) continue;
    clearTimeout(timer);
    trace('say', { booking: id, instance: current.instance, cleared: 'phase' });
  }
  booked.clear();
  // The last phase's line never runs on under this one.
  const hold = spoke ? sound.hush(READING_FADE_MS) : 0;
  current = { startedAt, instance, shift: null, fadeEnd: Date.now() + hold };
  return current;
}

/** Books `items` for `phase` at server time `now` (useSay's effect, outside React for tests). */
export function bookSay(
  items: readonly SayItem[],
  phase: SayPhase,
  now: number,
  sound: SoundApi,
): void {
  const instance = `${phase.phaseId}@${phase.startedAt}`;
  const state = enter(instance, phase.startedAt, sound);
  if (state === null) return;
  const clock = Date.now();
  // The shift is set by the first batch with a playable line: the entering batch can be empty.
  // Until then no line is playable, so none is booked.
  if (state.shift === null) {
    let first = Infinity;
    for (const item of items) {
      if (!isStale(item, phase, now)) first = Math.min(first, item.at - now);
    }
    if (first !== Infinity) {
      state.shift = Math.max(0, state.fadeEnd - clock - Math.max(0, first));
    }
  }
  const shift = state.shift ?? 0;
  for (const item of items) {
    const id = `${item.key}@${item.at}`;
    if (booked.has(id)) continue;
    const delay = item.at - now;
    if (isStale(item, phase, now)) {
      booked.set(id, null);
      trace('say', { key: item.key, instance, skipped: 'stale', delay });
      continue;
    }
    // Every line keeps the phase's shift, so the spacing holds, and none plays before the fade ends.
    // The clamp comes after the shift, so a line already due after the fade plays at once.
    const wait = Math.max(0, delay + shift, state.fadeEnd - clock);
    trace('say', { key: item.key, instance, booked: wait });
    const due = clock + wait;
    // A line reaches the shell only when due: the shell counts a clip as a cue the moment it is
    // asked for, and a voice booked ahead swallowed the phase's own chime (who-said-it p18).
    const timer = setTimeout(() => {
      booked.set(id, null);
      trace('say', { key: item.key, instance, fired: true, late: Date.now() - due });
      sound.clip(item.url, { gain: 1, duck: false });
    }, wait);
    booked.set(id, timer);
  }
}

/**
 * Plays each line at its server time `at`, once per phase instance, on every surface that mounts
 * it. A line that arrives late plays at once if it still ends before the phase does; a stale one
 * (a reload) never. A new phase ducks the last one's line out: its lines keep their spacing,
 * pushed back by what the fade needs, and none plays before the fade ends.
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
