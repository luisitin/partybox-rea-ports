// A critically damped spring, apart from the render loop so it can be tested without WebGL.
// The camera rig chases a goal with it: velocity carries across frames, so a goal that jumps (a new shot) or
// glides (a piece being followed) never makes the camera snap.
import type { Point3 } from './types';

/** A value and its velocity (units per second). */
export type Spring = { value: number; velocity: number };
export type Spring3 = readonly [Spring, Spring, Spring];

/** The spring's pace: it covers about 95 % of a step in `settle` seconds, with no overshoot from rest. */
const SETTLE_95 = 4.74;
/** One long frame (a hidden tab) counts as 100 ms, so the camera never lurches. */
const MAX_DT = 0.1;

export const spring = (value: number): Spring => ({ value, velocity: 0 });
export const spring3 = (p: Point3): Spring3 => [spring(p[0]), spring(p[1]), spring(p[2])];
export const readSpring3 = (s: Spring3): [number, number, number] => [
  s[0].value,
  s[1].value,
  s[2].value,
];

/** Moves `s` toward `goal` by `dt` seconds (exact for a fixed goal). `settle <= 0` jumps. */
export function stepSpring(s: Spring, goal: number, settle: number, dt: number): void {
  if (settle <= 0) {
    s.value = goal;
    s.velocity = 0;
    return;
  }
  const step = Math.min(Math.max(dt, 0), MAX_DT);
  const omega = SETTLE_95 / settle;
  const decay = Math.exp(-omega * step);
  const delta = s.value - goal;
  const push = s.velocity + omega * delta;
  s.value = goal + (delta + push * step) * decay;
  s.velocity = (s.velocity - omega * push * step) * decay;
}

export function stepSpring3(s: Spring3, goal: Point3, settle: number, dt: number): void {
  stepSpring(s[0], goal[0], settle, dt);
  stepSpring(s[1], goal[1], settle, dt);
  stepSpring(s[2], goal[2], settle, dt);
}
