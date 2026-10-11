// The hold glide of a Dice3d die: how far it has travelled to its hold slot (0 thrown, 1 held). A critically damped
// spring (ui/curves.ts) replaces the per-frame lerp, whose pace depended on the frame rate. Pure: the frame's delta goes
// in, and the glide is closed-form, so one glide reads the same at any frame rate.
import { spring } from '../ui/curves';

/** The glide's angular frequency, rad/s: critically damped at it (stiffness ω², damping 2ω). */
const OMEGA = 14;
/** The longest step taken in one call: a hitch (a background tab, a GC pause) cannot skip the glide. */
const MAX_STEP = 0.1;
/** Within this distance of its goal a glide rests on it. */
const SNAP = 0.001;

/**
 * One segment of a glide: `offset` (the start's distance from `goal`) and `velocity`, `seconds` into the spring.
 * A goal change starts a new segment where the old one is, so neither the value nor its speed jumps.
 */
export interface Glide {
  readonly goal: number;
  readonly offset: number;
  readonly velocity: number;
  readonly seconds: number;
}

/** A die at rest on `goal`. */
export function restingGlide(goal: number): Glide {
  return { goal, offset: 0, velocity: 0, seconds: 0 };
}

/** The glide's value and speed at its own time. */
function sample(glide: Glide): { value: number; velocity: number } {
  const [offset, velocity] = spring(
    glide.seconds,
    1,
    OMEGA * OMEGA,
    2 * OMEGA,
    glide.offset,
    glide.velocity,
  );
  return { value: glide.goal + offset, velocity };
}

/** The same motion aimed at a new goal: it starts where the glide is now, with its speed. */
function retarget(glide: Glide, goal: number): Glide {
  const now = sample(glide);
  return { goal, offset: now.value - goal, velocity: now.velocity, seconds: 0 };
}

/**
 * Advances a glide by `dt` seconds toward `goal`: returns the die's value (0 thrown, 1 held, between while it glides)
 * and the glide for the next call. `dt` is clamped to [0, MAX_STEP]; a negative or non-finite one holds. Within SNAP of
 * `goal` the value is exactly `goal` and the glide rests.
 */
export function stepGlide(glide: Glide, goal: number, dt: number): [number, Glide] {
  const from = goal === glide.goal ? glide : retarget(glide, goal);
  const step = Number.isFinite(dt) ? Math.min(MAX_STEP, Math.max(0, dt)) : 0;
  const next: Glide = { ...from, seconds: from.seconds + step };
  const value = sample(next).value;
  return Math.abs(value - goal) <= SNAP ? [goal, restingGlide(goal)] : [value, next];
}
