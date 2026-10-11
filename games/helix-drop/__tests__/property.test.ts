import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { game } from '../server/index';
import { settle } from '../server/world';
import { kit, freeze } from './helpers';

describe('seeded properties', () => {
  it.each([1, 2, 3])('event batching and JSON purity, campaign seed %i (1,000 runs)', (seed) => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2_147_483_647 }),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 5000 }),
        (towerSeed, x, y) => {
          const s = freeze(kit.start({ seed: towerSeed }));
          const from = s.began + Math.min(x, y),
            to = s.began + Math.max(x, y);
          const next = settle(s, to);
          expect(settle(settle(s, from), to)).toEqual(next);
          expect(JSON.parse(JSON.stringify(next))).toEqual(next);
          expect(
            next.runners.every((r) => Number.isFinite(r.y) && r.best >= r.floor && r.lives >= 0),
          ).toBe(true);
        },
      ),
      { seed, numRuns: 1000 },
    );
  });
  it('replays seeds 1, 2, 3 plus 1,000 generated seeds through mixed inputs', () => {
    const seedRng = createRng(17_015);
    const seeds = [1, 2, 3, ...Array.from({ length: 1000 }, () => seedRng.int(0, 2_147_483_647))];
    for (const seed of seeds) {
      const rng = createRng(seed);
      let a = kit.start({ seed }),
        b = kit.start({ seed });
      for (let i = 1; i <= 30; i++) {
        const event = {
          type: 'input' as const,
          playerId: i % 2 ? 'a' : 'b',
          now: 1000 + i * 137,
          input: { type: 'rotate' as const, dir: rng.pick([-1, 0, 1] as const) },
        };
        a = game.reduce(freeze(a), event);
        b = game.reduce(b, event);
      }
      expect(b).toEqual(a);
      expect(a.runners.every((r) => r.best >= 0 && r.best <= 120 && r.lives >= 0)).toBe(true);
    }
  });
});
