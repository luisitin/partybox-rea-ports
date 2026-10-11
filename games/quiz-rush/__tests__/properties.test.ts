// Independent generated event traces pin purity, replay, totality and key secrecy.
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { createRng } from '@partybox/game-sdk';
import { fuzzOnce, testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';

it('passes property traces with seeds 1,2,3 and 1000 independently sampled seeds', () => {
  const seeds = createRng(0x51a7);
  const samples = [1, 2, 3, ...Array.from({ length: 1000 }, () => seeds.int(4, 0x7fffffff))];
  for (const seed of samples) {
    const kit = testKit(game, { players: testPlayers(2 + (seed % 7)), seed });
    let s = kit.start();
    const initial = JSON.stringify(s);
    const events = fc.sample(
      fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 10, maxLength: 20 }),
      { seed, numRuns: 1 },
    )[0]!;
    for (const action of events) {
      const before = JSON.stringify(s);
      expect(fuzzOnce(game, s, seed)).toEqual([]);
      const e =
        action === 0
          ? { type: 'vip' as const, action: 'skip' as const, now: s.phase.startedAt + 1000 }
          : {
              type: 'input' as const,
              now: s.phase.startedAt + 1000,
              playerId: 'p1',
              input: { type: 'answer' as const, choice: action - 1, round: s.round },
            };
      const next = game.reduce(s, e);
      expect(JSON.stringify(s)).toBe(before);
      expect(game.reduce(JSON.parse(before), e)).toEqual(next);
      expect(JSON.parse(JSON.stringify(next))).toEqual(next);
      s = next;
    }
    expect(JSON.stringify(kit.start())).toBe(initial);
  }
}, 60_000);
