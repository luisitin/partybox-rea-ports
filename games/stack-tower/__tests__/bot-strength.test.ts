// Stronger bots must survive discrete observations without missing entire center crossings.
import { expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { kit, replaceTower, T0, towerOf } from './helpers';

it('sharp places near an unsampled center crossing at the real event time', () => {
  const initial = kit.start();
  const state = {
    ...replaceTower(initial, { ...towerOf(initial), height: 17, best: 17 }),
    checked: T0 + 750,
  };
  const input = game.bot.sampleInput(state, 'a', createRng(16), 'sharp');
  expect(input).toEqual({ type: 'drop', attempt: 0, level: 17 });
  const landed = kit.input(state, 'a', input!, state.checked);
  expect(towerOf(landed).height).toBe(18);
  expect(towerOf(landed).lastAt).toBe(T0 + 750);
  expect(towerOf(landed).cut?.amount).toBe(3);
});

it('easy < normal < sharp across seeded complete races at the engine observation cadence', () => {
  const averages: number[] = [];
  for (const skill of ['easy', 'normal', 'sharp'] as const) {
    let height = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const players = testPlayers(2);
      const rng = createRng(seed);
      let state = game.init({ players, settings: {}, seed, now: T0 });
      while (state.phase.id === 'play') {
        const now = state.phase.deadline!;
        state = game.reduce(state, {
          type: 'timer',
          now,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt,
        });
        for (const player of players) {
          const input = game.bot.sampleInput(state, player.id, rng, skill);
          if (input) state = kit.input(state, player.id, input, now);
        }
      }
      height += state.towers.reduce((sum, tower) => sum + tower.best, 0);
    }
    averages.push(height / 16);
  }
  expect(averages[1]).toBeGreaterThan(averages[0]!);
  expect(averages[2]).toBeGreaterThan(averages[1]!);
});
