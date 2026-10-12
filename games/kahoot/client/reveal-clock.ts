// The reveal's beats on the room's clock: counted from the server's `revealAt`, not from when this
// screen mounted, so a TV or phone that reloads or rejoins mid-reveal lands on the current beat
// (no replayed race, no second "bets are in" hold) and a VIP resume does not restart them.
import { useEffect, useState } from 'react';
import { useServerOffset } from '@partybox/game-sdk/ui';

/** ms already gone since `revealAt` on the server's clock; 0 without it (previews start at mount). */
export function revealElapsed(
  revealAt: number | undefined,
  offset: number,
  clockHeldAt?: number,
): number {
  return revealAt === undefined ? 0 : Math.max(0, (clockHeldAt ?? Date.now() + offset) - revealAt);
}

/**
 * True once `ms` have passed since the reveal began. `key` names the reveal (its deadline): a new
 * key starts a new hold, already done on its first paint when the room is past the beat.
 */
export function useRevealBeat(
  key: string | number | null,
  revealAt: number | undefined,
  ms: number,
  paused = false,
  clockHeldAt?: number,
): boolean {
  const offset = useServerOffset();
  const past = (): boolean =>
    ms <= 0 || revealElapsed(revealAt, offset, paused ? clockHeldAt : undefined) >= ms;
  const [held, setHeld] = useState(() => ({ key, done: past() }));
  // "Adjust state when a prop changes": a new reveal (or a resume's new deadline) re-reads the clock.
  if (held.key !== key) setHeld({ key, done: past() });
  useEffect(() => {
    if (key === null || paused) return;
    const wait = ms - revealElapsed(revealAt, offset);
    const done = (): void => setHeld((s) => (s.key === key && !s.done ? { key, done: true } : s));
    if (wait <= 0) {
      done();
      return;
    }
    const handle = setTimeout(done, wait);
    return () => clearTimeout(handle);
  }, [key, revealAt, offset, ms, paused]);
  return key !== null && held.key === key && held.done;
}
