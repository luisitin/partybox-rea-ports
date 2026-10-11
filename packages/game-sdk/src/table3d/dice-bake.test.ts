import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { bakeDiceRoll, faceUp, sampleDie } from './dice-bake';
import type { DiceBake, DiceBakeInput, Rapier } from './dice-bake';

// Rapier is a dependency of @react-three/rapier, not of this package: load the engine it brings.
let rapier: Rapier;
beforeAll(async () => {
  const here = createRequire(import.meta.url);
  const mod = createRequire(here.resolve('@react-three/rapier'))('@dimforge/rapier3d-compat');
  rapier = (mod.default ?? mod) as Rapier;
  await (rapier as unknown as { init: () => Promise<void> }).init();
});

const tray = { x: 550, z: 500, width: 340, depth: 240, floor: 0.5 };
const input = (values: number[], seed: number): DiceBakeInput => ({ values, seed, tray, size: 30 });
const last = (bake: DiceBake, i: number): { p: number[]; q: [number, number, number, number] } => {
  const s = bake.steps - 1;
  const p = bake.positions[i]!,
    r = bake.rotations[i]!;
  return {
    p: [p[s * 3]!, p[s * 3 + 1]!, p[s * 3 + 2]!],
    q: [r[s * 4]!, r[s * 4 + 1]!, r[s * 4 + 2]!, r[s * 4 + 3]!],
  };
};

describe('bakeDiceRoll', () => {
  it('ends with every die showing the number it was asked for, for every pair and several throws', () => {
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++)
        for (const seed of [1, 2, 3]) {
          const bake = bakeDiceRoll(rapier, input([a, b], seed * 101 + a * 7 + b));
          expect([0, 1].map((i) => faceUp(last(bake, i).q).value)).toEqual([a, b]);
        }
  });
  it('comes to rest flat on the floor, inside the tray, apart from each other', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const bake = bakeDiceRoll(rapier, input([3, 5], seed));
      const [d0, d1] = [last(bake, 0), last(bake, 1)];
      for (const d of [d0, d1]) {
        expect(faceUp(d.q).tilt).toBeLessThan(0.1);
        expect(d.p[1]).toBeGreaterThan(0.5 + 15 - 4);
        expect(d.p[1]).toBeLessThan(0.5 + 15 + 4);
        expect(Math.abs(d.p[0]! - tray.x)).toBeLessThan(tray.width / 2);
        expect(Math.abs(d.p[2]! - tray.z)).toBeLessThan(tray.depth / 2);
      }
      expect(Math.hypot(d0.p[0]! - d1.p[0]!, d0.p[2]! - d1.p[2]!)).toBeGreaterThan(27);
    }
  });
  it('is the same throw for the same seed and a different one for another', () => {
    const a = bakeDiceRoll(rapier, input([2, 6], 42)),
      b = bakeDiceRoll(rapier, input([2, 6], 42)),
      c = bakeDiceRoll(rapier, input([2, 6], 43));
    expect(Array.from(b.positions[0]!)).toEqual(Array.from(a.positions[0]!));
    expect(Array.from(b.rotations[1]!)).toEqual(Array.from(a.rotations[1]!));
    expect(Array.from(c.positions[0]!)).not.toEqual(Array.from(a.positions[0]!));
  });
  it('settles in a second or two, never instantly and never forever', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { seconds } = bakeDiceRoll(rapier, input([4, 4], seed));
      expect(seconds).toBeGreaterThan(0.4);
      expect(seconds).toBeLessThan(3);
    }
  });
  it('throws a single die or four as well as a pair', () => {
    for (const values of [[6], [1, 2, 3, 4]]) {
      const bake = bakeDiceRoll(rapier, input(values, 9));
      expect(bake.dice).toBe(values.length);
      expect(values.map((_, i) => faceUp(last(bake, i).q).value)).toEqual(values);
    }
  });
  it('treats a number outside 1 to 6 as the nearest face rather than throwing', () => {
    const bake = bakeDiceRoll(rapier, input([0, 9, Number.NaN], 5));
    expect([0, 1, 2].map((i) => faceUp(last(bake, i).q).value)).toEqual([1, 6, 1]);
  });
});

describe('sampleDie', () => {
  const bake = (): DiceBake => bakeDiceRoll(rapier, input([2, 5], 77));
  it('starts at the throw, rests on the last sample, and glides between', () => {
    const b = bake();
    const first = sampleDie(b, 0, 0),
      end = sampleDie(b, 0, b.seconds + 5),
      lastSample = last(b, 0);
    expect(first.position[1]).toBeGreaterThan(40);
    expect(end.position).toEqual(lastSample.p.map((n) => Math.fround(n)));
    const mid = sampleDie(b, 0, b.seconds / 2);
    expect(Math.hypot(...mid.rotation)).toBeCloseTo(1, 5);
    expect(mid.position.every(Number.isFinite)).toBe(true);
  });
  it('clamps before the start and stays finite for any time', () => {
    const b = bake();
    expect(sampleDie(b, 1, -3)).toEqual(sampleDie(b, 1, 0));
    for (const t of [Number.NaN, 0.013, 0.5, 99]) {
      const s = sampleDie(b, 1, t);
      expect(
        [...s.position, ...s.rotation].every((n) => Number.isFinite(n) || Number.isNaN(t)),
      ).toBe(true);
    }
  });
});
