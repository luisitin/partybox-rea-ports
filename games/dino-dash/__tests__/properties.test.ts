// The generated seed list is reproducible; named seeds remain permanent regressions.
import { describe, expect, it } from 'vitest';
import { createRng, seedRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { game } from '../server/index';
import { apply, collides, distanceAt, makeWorld, tick } from '../server/world';
import type { Input } from '../server/world';
import { T0, kit, runner, world } from './helpers';

const seedSource = createRng(0xd140cafe);
const generated = new Set<number>();
while (generated.size < 1000) generated.add(seedSource.int(4, 0x7fffffff));
export const PROPERTY_SEEDS = [1, 2, 3, ...generated];

function atDistance(distance: number): number {
  let low = 0;
  let high = 70_000;
  for (let i = 0; i < 32; i++) {
    const middle = (low + high) / 2;
    if (distanceAt(middle) < distance) low = middle;
    else high = middle;
  }
  return high;
}

describe('seeded course properties', () => {
  it('seeds 1, 2, 3 and 1000 generated seeds produce reachable, spaced shared courses', () => {
    for (const seed of PROPERTY_SEEDS) {
      const [course, rng] = makeWorld(seedRng(seed), ['a', 'b']);
      if (JSON.stringify(makeWorld(seedRng(seed), ['a', 'b'])) !== JSON.stringify([course, rng]))
        throw new Error(`seed ${seed}: replayed course or RNG differs`);
      if (course.runners.length !== 2 || course.runners.some((r) => r.distance !== 0))
        throw new Error(`seed ${seed}: runners must both start at zero distance`);
      let lastAt = 0;
      let lastBird = false;
      for (const o of course.course) {
        const contactAt = atDistance(o.x - 80);
        if (!(o.width >= 24)) throw new Error(`seed ${seed}, obstacle ${o.id}: width ${o.width} < 24`);
        if (!(o.width <= 42)) throw new Error(`seed ${seed}, obstacle ${o.id}: width ${o.width} > 42`);
        if (o.id === 0) {
          if (!(Math.abs(contactAt - 3000) < 0.0005))
            throw new Error(`seed ${seed}: first contact ${contactAt} differs from 3000ms`);
        }
        else {
          const gap = contactAt - lastAt;
          if (!(gap > 1449.99))
            throw new Error(`seed ${seed}, obstacle ${o.id}: gap ${gap} <= 1449.99ms`);
          if (!(gap < 2100.01))
            throw new Error(`seed ${seed}, obstacle ${o.id}: gap ${gap} >= 2100.01ms`);
        }
        if (o.kind === 'bird') {
          if (!(contactAt > 12_000))
            throw new Error(`seed ${seed}, obstacle ${o.id}: bird arrives before 12000ms`);
          if (lastBird !== false)
            throw new Error(`seed ${seed}, obstacle ${o.id}: consecutive birds`);
        }
        // A real action window exists throughout each obstacle's entire horizontal overlap.
        const jumping = runner('a', { jumpAt: contactAt - 260 });
        const ducking = runner('a', { duck: true });
        for (let ms = contactAt - 100; ms <= contactAt + 150; ms += 20) {
          if (collides(o.kind === 'bird' ? ducking : jumping, o, ms) !== false)
            throw new Error(`seed ${seed}, obstacle ${o.id}, sample ${ms}: no safe action window`);
        }
        lastAt = contactAt;
        lastBird = o.kind === 'bird';
      }
    }
  }, 20_000);

  it('the same generated event streams replay byte-identically without rewinding or reviving', () => {
    for (const seed of PROPERTY_SEEDS) {
      const rng = createRng(seed);
      let first = kit.start({ seed });
      let replay = kit.start({ seed });
      let now = T0;
      for (let i = 0; i < 24; i++) {
        now += rng.int(0, 350);
        const input: Input =
          rng.int(0, 1) === 0 ? { type: 'jump' } : { type: 'duck', down: rng.int(0, 1) === 1 };
        const event: GameEvent<Input> =
          i % 5 === 0
            ? { type: 'timer', now, phaseId: first.phase.id, startedAt: first.phase.startedAt }
            : { type: 'input', now, playerId: `p${rng.int(1, 4)}`, input };
        const before = JSON.stringify(first);
        const next = game.reduce(first, event);
        replay = game.reduce(replay, event);
        expect(JSON.stringify(first)).toBe(before);
        expect(JSON.stringify(next)).toBe(JSON.stringify(replay));
        if (next.round === first.round) {
          expect(next.world.checked).toBeGreaterThanOrEqual(first.world.checked);
          for (const r of first.world.runners.filter((r) => r.died !== null))
            expect(next.world.runners.find((n) => n.id === r.id)).toEqual(r);
        }
        first = next;
      }
    }
  }, 20_000);

  it('batching elapsed time cannot change deaths or distances for 1003 generated worlds', () => {
    for (const seed of PROPERTY_SEEDS) {
      const rng = createRng(seed);
      let start = world([runner('a'), runner('b')]);
      const [generated] = makeWorld(seedRng(seed), ['a', 'b']);
      start = { ...start, course: generated.course };
      start = apply(start, 'a', { type: 'jump' }, rng.int(0, 500));
      const end = rng.int(1500, 9000);
      const once = tick(start, end);
      const parts = tick(tick(tick(start, 1000), 1400), end);
      expect(parts).toEqual(once);
      expect(once.runners.every((r) => Number.isFinite(r.distance) && r.distance >= 0)).toBe(true);
    }
  });
});
