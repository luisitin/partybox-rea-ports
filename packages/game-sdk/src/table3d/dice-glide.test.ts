import { describe, expect, it } from 'vitest';
import { restingGlide, stepGlide } from './dice-glide';
import type { Glide } from './dice-glide';

/** The value after each of `steps` frames of `dt` seconds toward `goal`, starting from `glide`. */
function frames(glide: Glide, goal: number, dt: number, steps: number): number[] {
  const values: number[] = [];
  let current = glide;
  for (let i = 0; i < steps; i++) {
    const [value, next] = stepGlide(current, goal, dt);
    values.push(value);
    current = next;
  }
  return values;
}

describe('stepGlide: the hold glide of a die', () => {
  it('glides from rest to its goal with no overshoot, about 99 % by 0.5 s, then rests on the goal', () => {
    const values = frames(restingGlide(0), 1, 1 / 60, 90);
    values.forEach((value, i) => {
      expect(value).toBeGreaterThanOrEqual(i === 0 ? 0 : values[i - 1]!);
      expect(value).toBeLessThanOrEqual(1);
    });
    expect(values[29]).toBeGreaterThan(0.99);
    expect(values[89]).toBe(1);
  });

  it('reads the same at any frame rate', () => {
    const last = (dt: number, steps: number): number => {
      const values = frames(restingGlide(0), 1, dt, steps);
      return values[values.length - 1]!;
    };
    const coarse = last(1 / 30, 9);
    expect(Math.abs(coarse - last(1 / 60, 18))).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(coarse - last(1 / 120, 36))).toBeLessThanOrEqual(1e-9);
  });

  it('keeps its value and its speed through a goal change mid-glide', () => {
    const [, moving] = stepGlide(restingGlide(0), 1, 0.1);
    const [before] = stepGlide(moving, 1, 0);
    const [turned] = stepGlide(moving, 0, 0);
    expect(turned).toBeCloseTo(before, 12);
    // It is still rising at the flip, so the value keeps rising for a moment toward the new goal of 0.
    const [after] = stepGlide(moving, 0, 0.01);
    expect(after).toBeGreaterThan(before);
  });

  it('clamps a long frame to 0.1 s, and holds on a negative or non-finite one', () => {
    expect(stepGlide(restingGlide(0), 1, 5)).toEqual(stepGlide(restingGlide(0), 1, 0.1));
    const [, moving] = stepGlide(restingGlide(0), 1, 0.1);
    expect(stepGlide(moving, 1, -1)).toEqual(stepGlide(moving, 1, 0));
    expect(stepGlide(moving, 1, Number.NaN)).toEqual(stepGlide(moving, 1, 0));
  });

  it('stays at rest on its goal', () => {
    expect(stepGlide(restingGlide(1), 1, 1 / 60)).toEqual([1, restingGlide(1)]);
    expect(stepGlide(restingGlide(0), 0, 1 / 60)).toEqual([0, restingGlide(0)]);
  });
});
