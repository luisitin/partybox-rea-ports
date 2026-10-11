// A short line the phone shell shows in its countdown row, left of the bar (I-794 H, the owner
// 2026-09-24: "whose book and which round move into the timer bar"). A game screen sets it with
// `useTimerLabel` while it is mounted; the shell reads it with `useShellTimerLabel`. Nothing
// crosses the wire: each phone writes its own, in its own language. `text` gives way first (it
// ends in "…" when the row is short); `tail` (e.g. "1/6") is always shown whole.
import { useLayoutEffect, useSyncExternalStore } from 'react';

export interface TimerLabel {
  text: string;
  tail?: string;
}

const listeners = new Set<() => void>();
let current: TimerLabel | null = null;

function set(next: TimerLabel | null): void {
  current = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Shows `text` (and `tail`) in the shell's countdown row while the calling screen is mounted;
 *  `null` shows nothing. The last screen to mount wins; its unmount clears only its own label. */
export function useTimerLabel(text: string | null, tail?: string): void {
  // A layout effect (T-0281): the shell re-renders with the label before the first paint, so the
  // bar never draws full width for a frame and then jumps right when the label arrives.
  useLayoutEffect(() => {
    if (text === null) return undefined;
    const mine: TimerLabel = tail === undefined ? { text } : { text, tail };
    set(mine);
    return () => {
      if (current === mine) set(null);
    };
  }, [text, tail]);
}

/** The shell's side: the label the mounted game screen asked for, if any. */
export function useShellTimerLabel(): TimerLabel | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
