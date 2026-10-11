import { describe, expect, it } from 'vitest';
import { readSpring3, spring, spring3, stepSpring, stepSpring3 } from './smooth';

const run = (
  s: ReturnType<typeof spring>,
  goal: number,
  settle: number,
  seconds: number,
): number[] => {
  const out: number[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    stepSpring(s, goal, settle, 1 / 60);
    out.push(s.value);
  }
  return out;
};

describe('stepSpring', () => {
  it('covers about 95 % of a step in `settle` seconds and never overshoots from rest', () => {
    const s = spring(0);
    const path = run(s, 100, 1, 4);
    expect(path[59]).toBeGreaterThan(90);
    expect(path[59]).toBeLessThan(99);
    expect(Math.max(...path)).toBeLessThanOrEqual(100);
    expect(path.every((v, i) => i === 0 || v >= path[i - 1]!)).toBe(true);
    expect(path.at(-1)).toBeCloseTo(100, 1);
  });
  it('is frame-rate independent: 30 fps and 120 fps land in the same place', () => {
    const at = (fps: number): number => {
      const s = spring(0);
      for (let i = 0; i < fps; i++) stepSpring(s, 50, 1, 1 / fps);
      return s.value;
    };
    expect(at(30)).toBeCloseTo(at(120), 4);
  });
  it('is continuous when the goal jumps: the position never snaps, the velocity bends by a bounded amount', () => {
    const s = spring(0);
    run(s, 100, 0.8, 0.5);
    const x = s.value,
      before = s.velocity;
    expect(before).toBeGreaterThan(0);
    stepSpring(s, -100, 0.8, 1 / 60);
    // One frame later: still within a frame's travel of where it was, and the speed changed by at most
    // the spring's pull over that frame (omega^2 x distance x dt), not instantly to the new goal's.
    const omega = 4.74 / 0.8;
    expect(Math.abs(s.value - x)).toBeLessThan((Math.abs(before) + 2) / 60 + 1);
    expect(Math.abs(s.velocity - before)).toBeLessThan(omega * omega * (x + 100) * (1 / 60) * 1.1);
  });
  it('trails a goal that moves steadily without stepping: bounded lag, steady speed', () => {
    const s = spring(0);
    const speeds: number[] = [];
    let last = 0;
    for (let i = 0; i < 360; i++) {
      stepSpring(s, i * (200 / 60), 0.5, 1 / 60); // goal moves 200 units a second
      speeds.push(s.value - last);
      last = s.value;
    }
    const tail = speeds.slice(-60);
    expect(Math.max(...tail) - Math.min(...tail)).toBeLessThan(0.01);
    expect(359 * (200 / 60) - s.value).toBeLessThan(200 * 0.5);
  });
  it('jumps when settle is 0 (reduced motion) and counts a long pause as 100 ms', () => {
    const a = spring(5);
    stepSpring(a, 9, 0, 1 / 60);
    expect(a.value).toBe(9);
    expect(a.velocity).toBe(0);
    const b = spring(0),
      c = spring(0);
    stepSpring(b, 10, 1, 30);
    stepSpring(c, 10, 1, 0.1);
    expect(b.value).toBe(c.value);
    stepSpring(b, 10, 1, -5);
    expect(Number.isFinite(b.value)).toBe(true);
  });
  it('moves three axes together', () => {
    const s = spring3([0, 0, 0]);
    stepSpring3(s, [10, -10, 20], 1, 1 / 60);
    const [x, y, z] = readSpring3(s);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeLessThan(0);
    expect(z).toBeCloseTo(2 * x, 6);
  });
});
