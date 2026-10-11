// The tally build's maths (T-0287): pure functions of time, no DOM. Tally.tsx measures the boxes
// and draws; everything that can be decided from numbers alone lives here so it can be tested.

export type TallyKind = 'face' | 'points';

/** One thing that travels: a voter's face to the card it voted for, or a "+N" to a score. */
export interface TallyFlightSpec {
  /** Unique within one tally; a landing slot is looked up by this id (`tally.slot(id)`). */
  id: string;
  /** `data-tally-key` of the element it leaves. Missing from the DOM ⇒ it does not fly, it just lands. */
  from: string;
  /** `data-tally-key` of the element it lands on. */
  to: string;
  /** ms after the tally starts when it leaves (a points token pops in place at `pop` first). */
  at: number;
  /** Flight time in ms (default 640); 0 lands at `at`. */
  dur?: number;
  /** Px (in the 1920 design) the arc rises above the straight line. Default 170. */
  lift?: number;
  /** A face token: the avatar that travels. */
  avatarId?: string;
  /** A points token: the text ("+400"). */
  label?: string;
  /** ms a points token pops in over its source before it leaves (default: it appears at `at`). */
  pop?: number;
  /** The source while this token is away: it dims to `opacity`, and returns at `back` ms (never if unset). */
  away?: { opacity: number; back?: number };
  /** A points token thins to this opacity while it crosses the first half of its flight, so it never hides what it flies over (default 1: solid). */
  sheer?: number;
}

export const DEFAULT_FLIGHT_MS = 640;
export const DEFAULT_LIFT = 170;

export const kindOf = (f: TallyFlightSpec): TallyKind =>
  f.label !== undefined ? 'points' : 'face';
export const durOf = (f: TallyFlightSpec): number => Math.max(0, f.dur ?? DEFAULT_FLIGHT_MS);
export const landedAt = (f: TallyFlightSpec): number => f.at + durOf(f);

/** Reduced motion: nothing flies and everything lands at once (as `useBeats` shows all its beats). */
export function withoutFlight(f: TallyFlightSpec): TallyFlightSpec {
  return { ...f, at: 0, dur: 0, pop: undefined, away: undefined };
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0 before `start`, 1 after `start + dur`; a zero duration is a step. */
export function progress(t: number, start: number, dur: number): number {
  return dur <= 0 ? (t >= start ? 1 : 0) : clamp01((t - start) / dur);
}

export const easeInOut = (p: number): number =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

/** Overshoot pop-in, 0 → 1 (with a little more than 1 on the way). */
export function popIn(q: number): number {
  if (q <= 0) return 0;
  const c = 1.70158;
  const x = clamp01(q) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

export interface Box {
  cx: number;
  cy: number;
  size: number;
}

export interface Pose {
  cx: number;
  cy: number;
  /** Multiplies the token's own size (face: the from-box width; points: its natural size). */
  scale: number;
  rot: number;
}

/** A token's opacity at flight progress `p`: solid on the ground, down to `sheer` while it crosses the
 *  middle of the flight (p 0.15-0.55, soft edges), solid again for the last stretch. */
export function flightOpacity(p: number, sheer = 1): number {
  const edge = (x: number): number =>
    Math.min(1, Math.max(0, x)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, x)));
  const dip = edge((p - 0.05) / 0.15) * (1 - edge((p - 0.45) / 0.15));
  return 1 - (1 - sheer) * dip;
}

/** Where a token is at flight progress `p` (0..1): an arc with `lift`, a size bump at mid-air, a tilt. */
export function flightPose(from: Box, to: Box, p: number, lift: number, kind: TallyKind): Pose {
  const e = easeInOut(clamp01(p));
  const arc = Math.sin(Math.PI * e);
  const cx = lerp(from.cx, to.cx, e);
  const cy = lerp(from.cy, to.cy, e) - lift * arc;
  if (kind === 'points') return { cx, cy, scale: lerp(1.05, 0.8, e), rot: -6 * arc };
  const size = lerp(from.size, to.size, e) * (1 + 0.18 * arc);
  const dir = to.cx >= from.cx ? 1 : -1;
  return { cx, cy, scale: size / Math.max(1, from.size), rot: 7 * Math.sin(2 * Math.PI * p) * dir };
}

/** Flights of `flights` that have landed by `t`. */
export function landedCount(flights: readonly TallyFlightSpec[], t: number): number {
  return flights.filter((f) => landedAt(f) <= t).length;
}

/** Departure times for `n` tokens, `step` ms apart but never spread over more than `span` ms. */
export function staggerAt(n: number, start: number, step: number, span: number): number[] {
  const gap = n > 1 ? Math.min(step, span / (n - 1)) : 0;
  return Array.from({ length: n }, (_, i) => Math.round(start + i * gap));
}

/** When the last of `flights` lands (0 for none). */
export function lastLanding(flights: readonly TallyFlightSpec[]): number {
  return flights.reduce((m, f) => Math.max(m, landedAt(f)), 0);
}

/** A stable string of the schedule: an effect keyed on it re-runs only when the schedule changes. */
export function signature(flights: readonly TallyFlightSpec[]): string {
  return flights.map((f) => `${f.id}>${f.from}>${f.to}@${f.at}+${durOf(f)}`).join('|');
}
