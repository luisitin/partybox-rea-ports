import { expect, it } from 'vitest';
import fc from 'fast-check';
import { seedRng } from '@partybox/game-sdk';
import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { ROUND_MS, STEP_MS, applyFlap, makeWorld, tick } from '../server/world';
import { fuzzOnce } from '../../../packages/game-sdk/src/contract-tests/fuzz';
import { playGame, replay } from '../../../packages/game-sdk/src/contract-tests/play';

// Seed 20261011 makes the 1,000 random examples repeatable on every machine.
// The original examples 1, 2 and 3 are exercised explicitly before them.
const kit = testKit(game, { settings: { rounds: 1 } });

function checkWorld(seed: number, count: number, first: number, second: number): void {
  const ids = Array.from({ length: count }, (_, i) => `p${i + 1}`);
  const [start, rng] = makeWorld(seedRng(seed), ids);
  const [again, againRng] = makeWorld(seedRng(seed), ids);
  expect(again).toEqual(start);
  expect(againRng).toEqual(rng);
  const inputAt = Math.min(first, 400);
  const changed = applyFlap(tick(start, inputAt), 'p1', inputAt);
  const end = Math.max(first, second);
  expect(tick(tick(changed, Math.min(first, second)), end)).toEqual(tick(changed, end));
  const judged = tick(changed, end);
  expect(judged.checked % STEP_MS).toBe(0);
  for (const bird of judged.birds) {
    if (bird.died !== null) {
      expect(bird.died % STEP_MS).toBe(0);
      expect(bird.died).toBeLessThanOrEqual(judged.checked);
    }
  }
  expect(JSON.parse(JSON.stringify(judged))).toEqual(judged);
  expect(start.birds.every((b) => b.flight.at === 0)).toBe(true);
}

it('holds deterministic judging, partition independence and JSON safety for seeds 1, 2, 3 + 1,000 random seeds', () => {
  for (const seed of [1, 2, 3]) checkWorld(seed, 8, 377, ROUND_MS);
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 0x7fffffff }),
      fc.integer({ min: 2, max: 8 }),
      fc.integer({ min: 0, max: 1200 }),
      fc.integer({ min: 0, max: 4000 }),
      checkWorld,
    ),
    { seed: 20261011, numRuns: 1000 },
  );
}, 60_000);

it('is total across SDK fuzz events for seeds 1, 2, 3 + 1,000 random seeds', () => {
  const check = (seed: number): void => {
    const s = kit.start({ seed });
    expect(fuzzOnce(game, s, seed)).toEqual([]);
    const paused = kit.vip(s, 'pause');
    expect(fuzzOnce(game, paused, seed)).toEqual([]);
  };
  for (const seed of [1, 2, 3]) check(seed);
  fc.assert(fc.property(fc.integer({ min: 0, max: 0x7fffffff }), check), {
    seed: 20261011,
    numRuns: 1000,
  });
}, 60_000);

it('replays the real SDK runner byte-for-byte for original seeds and all player counts', () => {
  for (const seed of [1, 2, 3]) {
    for (let players = 2; players <= 8; players++) {
      const run = playGame(game, {
        players,
        seed,
        strategy: 'fast',
        settings: { rounds: 1 },
        maxSimMs: game.manifest.estimatedMinutes * 2 * 60_000,
      });
      expect(run.invalidInputs).toEqual([]);
      expect(run.stuck).toBe(false);
      expect(JSON.stringify(replay(game, run.init, run.events).at(-1))).toBe(
        JSON.stringify(run.finalState),
      );
    }
  }
});
