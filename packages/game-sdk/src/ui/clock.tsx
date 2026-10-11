// Server-time awareness for the UI. Deadlines in views are SERVER timestamps; phones and TVs can be
// seconds off, so the shells measure the offset from every push and provide it here.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { JSX, ReactNode } from 'react';

const OffsetContext = createContext<number>(0);

export interface ServerClockProviderProps {
  /** serverNow - Date.now(), measured by the shell. */
  offsetMs: number;
  children: ReactNode;
}

export function ServerClockProvider({ offsetMs, children }: ServerClockProviderProps): JSX.Element {
  return <OffsetContext.Provider value={offsetMs}>{children}</OffsetContext.Provider>;
}

/** Current server time, re-rendering every `intervalMs`. */
/** Server time − this device's time (ms): compare a view's `deadline` with `Date.now() + offset`. */
export function useServerOffset(): number {
  return useContext(OffsetContext);
}

/** The last wall-clock reading any ticker took; every subscriber refreshes it on its own cadence. */
let latest = Date.now();

/** Current server time; `paused` holds this caller's reading until resume. */
export function useServerNow(intervalMs = 250, paused = false, clockHeldAt?: number): number {
  const offset = useContext(OffsetContext);
  // The shared reading is the last tick of any ticker, so after a quiet spell it can be seconds old when this reader
  // mounts. The first render never reads earlier than the mount: a countdown dates its phase instance from that render
  // (phaseSeen.ts), and an old reading would start its bar too early (All the Marbles' TV bar read 81 % at 29 s).
  const [mountedAt] = useState(() => Date.now());
  const subscribe = useCallback(
    (notify: () => void) => {
      // Re-subscribe with a fresh reading on resume: the server has shifted the deadline/start
      // by the pause's length, so a pre-pause tick would briefly show the wrong elapsed time.
      latest = Date.now();
      notify();
      if (paused) return () => undefined;
      const handle = setInterval(() => {
        latest = Date.now();
        notify();
      }, intervalMs);
      return () => clearInterval(handle);
    },
    [intervalMs, paused],
  );
  const tick = useSyncExternalStore(
    subscribe,
    () => latest,
    () => latest,
  );
  // A resume's first render would read the reading from before the pause: the store refreshes on its
  // subscription, which runs after the paint. So the layout effect takes a fresh reading and renders again
  // before anything is painted (T-0779, known limit 3).
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const wasPaused = useRef(paused);
  useLayoutEffect(() => {
    if (wasPaused.current && !paused) {
      latest = Date.now();
      refresh();
    }
    wasPaused.current = paused;
  }, [paused]);
  const now = Math.max(tick, mountedAt) + offset;
  // Other clock subscribers keep ticking while this game is held. Capture per caller, and hold
  // the server offset too: a fresh network measurement must not move a paused chart.
  const [held, setHeld] = useState<number | null>(null);
  if (paused && held === null) setHeld(now);
  if (!paused && held !== null) setHeld(null);
  return paused ? (clockHeldAt ?? held ?? now) : now;
}

/**
 * Whole seconds left until `deadline` (never negative); null when there is no deadline.
 * `intervalMs`: how often to look — a countdown two screens show together polls finer (50 ms), so
 * their digits flip within a frame of each other instead of up to 250 ms apart (Bingo, loop 302).
 */
export function useSecondsLeft(
  deadline: number | null,
  paused = false,
  intervalMs = 250,
  clockHeldAt?: number,
): number | null {
  const now = useServerNow(intervalMs, paused, clockHeldAt);
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

// ── beats on the server's clock (ABSTRACTION_AUDIT #15) ─────────────────────────────────────────
// A phone or TV that mounts late (a reload, a late join, a slow push) lands on the beat the room is
// on instead of replaying the show from its own mount. Sequencing, not decoration: nothing here is
// collapsed by reduced motion. (`useBeats` / `useHold` in motion.ts count from mount.)
/** ms since the server time `at`, on this device's clock. */
function sinceMs(at: number, offset: number): number {
  return Date.now() + offset - at;
}

/** The index of the latest beat reached `elapsed` ms in (`atMs` ascending, starting at 0). */
export function beatAt(elapsed: number, atMs: readonly number[]): number {
  let beat = 0;
  atMs.forEach((t, i) => {
    if (elapsed >= t) beat = i;
  });
  return beat;
}

/** True once the server time reaches `at + delayMs`; re-armed when `at` or the delay changes. */
export function useServerBeat(at: number, delayMs = 0): boolean {
  const offset = useServerOffset();
  const key = `${at}|${delayMs}|${offset}`;
  const [beat, setBeat] = useState(() => ({ key, done: sinceMs(at, offset) >= delayMs }));
  // "Adjust state when a prop changes" (as useHold): a new beat re-arms during render.
  if (beat.key !== key) setBeat({ key, done: sinceMs(at, offset) >= delayMs });
  useEffect(() => {
    const left = delayMs - sinceMs(at, offset);
    if (left <= 0) return undefined;
    const handle = setTimeout(
      () => setBeat((b) => (b.key === key ? { key, done: true } : b)),
      left,
    );
    return () => clearTimeout(handle);
  }, [key, at, delayMs, offset]);
  return beat.key === key ? beat.done : sinceMs(at, offset) >= delayMs;
}

/**
 * Which beat of a choreography is showing: `atMs` ascending from 0, counted from the server time
 * `startedAt`. Key the component by the phase instance: the first render reads the clock, later
 * beats come by timer.
 */
export function useServerBeats(startedAt: number, atMs: readonly number[]): number {
  const offset = useServerOffset();
  const [beat, setBeat] = useState(() => beatAt(sinceMs(startedAt, offset), atMs));
  const signature = atMs.join(',');
  useEffect(() => {
    const elapsed = sinceMs(startedAt, offset);
    const timers = signature
      .split(',')
      .map((t, i) => ({ t: Number(t) - elapsed, i }))
      .filter((x) => x.t > 0)
      .map((x) => setTimeout(() => setBeat(x.i), x.t));
    return () => timers.forEach(clearTimeout);
  }, [startedAt, offset, signature]);
  // Every push re-measures the offset and re-arms only the timers still ahead, so a jump across the
  // next beat would drop it: the beat shown is never behind what the clock says (and never goes back).
  return Math.max(beat, beatAt(sinceMs(startedAt, offset), atMs));
}

/** ms since the server time `startedAt`, read once at mount (CSS delays that must skip ahead). */
export function useServerElapsed(startedAt: number): number {
  const offset = useServerOffset();
  const [elapsed] = useState(() => Math.max(0, sinceMs(startedAt, offset)));
  return elapsed;
}
