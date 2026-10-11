import { describe, expect, it } from 'vitest';
import {
  easeInOut,
  flightOpacity,
  flightPose,
  landedAt,
  landedCount,
  lastLanding,
  popIn,
  progress,
  signature,
  staggerAt,
  withoutFlight,
} from './tallyMath';
import type { TallyFlightSpec } from './tallyMath';

const face = (id: string, at: number, dur?: number): TallyFlightSpec => ({
  id,
  from: `chip:${id}`,
  to: `slot:${id}`,
  at,
  dur,
  avatarId: 'fox',
});

describe('tally maths', () => {
  it('a flight lands at + dur (default 640 ms); a zero duration lands at once', () => {
    expect(landedAt(face('a', 500))).toBe(1140);
    expect(landedAt(face('a', 500, 0))).toBe(500);
    expect(progress(499, 500, 0)).toBe(0);
    expect(progress(500, 500, 0)).toBe(1);
  });

  it('progress runs 0 → 1 across the flight and clamps', () => {
    expect(progress(0, 100, 200)).toBe(0);
    expect(progress(200, 100, 200)).toBe(0.5);
    expect(progress(900, 100, 200)).toBe(1);
  });

  it('easeInOut and popIn hit their ends; popIn overshoots on the way', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(popIn(0)).toBe(0);
    expect(popIn(1)).toBeCloseTo(1);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map(popIn))).toBeGreaterThan(1);
  });

  it('the pose starts on the source, ends on the target, and rises on an arc in between', () => {
    const from = { cx: 100, cy: 900, size: 72 };
    const to = { cx: 700, cy: 500, size: 56 };
    const a = flightPose(from, to, 0, 200, 'face');
    const z = flightPose(from, to, 1, 200, 'face');
    const m = flightPose(from, to, 0.5, 200, 'face');
    expect([a.cx, a.cy, a.scale]).toEqual([100, 900, 1]);
    expect(z.cx).toBeCloseTo(700);
    expect(z.cy).toBeCloseTo(500);
    expect(z.scale).toBeCloseTo(56 / 72);
    expect(m.cy).toBeLessThan(700); // straight line at 0.5 is 700: the arc is above it
    expect(m.scale).toBeGreaterThan(1.05 * (64 / 72)); // the mid-air bump
  });

  it('a points token shrinks 1.05 → 0.8 and tilts back on the way', () => {
    const from = { cx: 0, cy: 0, size: 0 };
    const to = { cx: 400, cy: 0, size: 0 };
    expect(flightPose(from, to, 0, 100, 'points').scale).toBeCloseTo(1.05);
    expect(flightPose(from, to, 1, 100, 'points').scale).toBeCloseTo(0.8);
    expect(flightPose(from, to, 0.5, 100, 'points').rot).toBeLessThan(0);
  });

  it('counts landings and finds the last one', () => {
    const fs = [face('a', 0), face('b', 400), face('c', 800)];
    expect(landedCount(fs, 639)).toBe(0);
    expect(landedCount(fs, 1040)).toBe(2);
    expect(landedCount(fs, 5000)).toBe(3);
    expect(lastLanding(fs)).toBe(1440);
    expect(lastLanding([])).toBe(0);
  });

  it('stagger keeps the gap but never spreads past the span', () => {
    expect(staggerAt(3, 500, 360, 1600)).toEqual([500, 860, 1220]);
    const many = staggerAt(16, 500, 360, 1500);
    expect(many[0]).toBe(500);
    expect(many[15]).toBeLessThanOrEqual(2000);
    expect(staggerAt(1, 500, 360, 1600)).toEqual([500]);
    expect(staggerAt(0, 500, 360, 1600)).toEqual([]);
  });

  it('reduced motion lands every token at once, with nothing dimmed', () => {
    const fs = [face('a', 300), { ...face('b', 700), away: { opacity: 0.3 } }].map(withoutFlight);
    expect(fs.map(landedAt)).toEqual([0, 0]);
    expect(fs[1]?.away).toBeUndefined();
  });

  it('the signature changes with the schedule, not with the array identity', () => {
    const a = [face('a', 100)];
    expect(signature(a)).toBe(signature([face('a', 100)]));
    expect(signature(a)).not.toBe(signature([face('a', 200)]));
  });
  it('a sheer token is solid on the ground and at the end, and gone through the middle', () => {
    expect(flightOpacity(0, 0)).toBe(1);
    expect(flightOpacity(1, 0)).toBe(1);
    expect(flightOpacity(0.3, 0)).toBeCloseTo(0);
    expect(flightOpacity(0.3, 0.4)).toBeCloseTo(0.4);
    expect(flightOpacity(0.3)).toBe(1);
  });
});
