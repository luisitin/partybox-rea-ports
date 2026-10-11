import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { bakeDrop, sampleDrop } from './drop-bake';
import type { DropBake } from './drop-bake';
import type { Rapier } from './dice-bake';

// Rapier is a dependency of @react-three/rapier, not of this package: load the engine it brings.
let rapier: Rapier;
beforeAll(async () => {
  const here = createRequire(import.meta.url);
  const mod = createRequire(here.resolve('@react-three/rapier'))('@dimforge/rapier3d-compat');
  rapier = (mod.default ?? mod) as Rapier;
  await (rapier as unknown as { init: () => Promise<void> }).init();
});

const house = (seed: number): DropBake =>
  bakeDrop(rapier, { seed, size: [11, 12, 11], height: 70 });

describe('bakeDrop', () => {
  it('ends at exactly the identity pose, however the box landed', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const end = sampleDrop(house(seed), 99);
      expect(end.position).toEqual([0, 0, 0]);
      expect(end.rotation).toEqual([0, 0, 0, 1]);
    }
  });
  it('starts high up and tilted, and is down within a short fall', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const bake = house(seed);
      const start = sampleDrop(bake, 0);
      expect(start.position[1]).toBeGreaterThan(40);
      expect(Math.abs(start.rotation[3])).toBeLessThan(0.9999);
      expect(bake.seconds).toBeGreaterThan(0.2);
      expect(bake.seconds).toBeLessThan(2);
    }
  });
  it('never sinks through the floor and stays near its place', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const bake = house(seed);
      for (let t = 0; t <= bake.seconds; t += 1 / 60) {
        const p = sampleDrop(bake, t).position;
        expect(p[1]).toBeGreaterThanOrEqual(0);
        expect(Math.hypot(p[0], p[2])).toBeLessThan(40);
      }
    }
  });
  it('is the same fall for the same seed and a different one for another', () => {
    const a = house(5),
      b = house(5),
      c = house(6);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.positions)).not.toEqual(Array.from(c.positions));
  });
});
