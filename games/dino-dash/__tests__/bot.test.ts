import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { game } from '../server/index';
import { kit, obstacle, runner, world } from './helpers';
import { simulateOne } from '../../../jobs/P13-dino-dash/simulation';

describe('bot strategy', () => {
  it('three strengths produce ordered mean distance and normal races have distinct finishes', () => {
    const totals: Record<string, number> = { easy: 0, normal: 0, sharp: 0 };
    let variedNormalMatches = 0;
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      for (let seed = 1; seed <= 24; seed++) {
        const scores = Object.values(simulateOne(4, seed, skill).final.scores);
        totals[skill]! += scores.reduce((sum, score) => sum + score, 0);
        if (skill === 'normal' && new Set(scores).size > 1) variedNormalMatches++;
      }
    }
    expect(totals.sharp).toBeGreaterThan(totals.normal!);
    expect(totals.normal).toBeGreaterThan(totals.easy!);
    expect(variedNormalMatches).toBeGreaterThan(0);
  }, 20_000);

  it('anticipates visible rocks, ducks for birds and releases after the bird passes', () => {
    const s = { ...kit.start(), world: world([runner('p1')], [obstacle('rock', 180)]) };
    expect(game.bot.sampleInput(s, 'p1', createRng(1), 'sharp')).toEqual({ type: 'jump' });
    const bird = { ...s, world: world([runner('p1')], [obstacle('bird', 180)]) };
    expect(game.bot.sampleInput(bird, 'p1', createRng(1), 'normal')).toEqual({
      type: 'duck',
      down: true,
    });
    const held = { ...s, world: world([runner('p1', { duck: true })], [obstacle('rock', 180)]) };
    expect(game.bot.sampleInput(held, 'p1', createRng(1), 'sharp')).toEqual({
      type: 'duck',
      down: false,
    });
  });

  it('strength changes its reaction window and easy bots sometimes miss a reaction', () => {
    const s = { ...kit.start(), world: world([runner('p1')], [obstacle('rock', 208)]) };
    expect(game.bot.sampleInput(s, 'p1', createRng(1), 'normal')).toBeNull();
    expect(game.bot.sampleInput(s, 'p1', createRng(1), 'sharp')).toEqual({ type: 'jump' });
    const close = { ...s, world: world([runner('p1')], [obstacle('rock', 150)]) };
    const outcomes = Array.from({ length: 100 }, (_, seed) =>
      game.bot.sampleInput(close, 'p1', createRng(seed), 'easy'),
    );
    expect(outcomes.some((input) => input === null)).toBe(true);
    expect(outcomes.some((input) => input?.type === 'jump')).toBe(true);
  });

  it('refuses unknown, dead, disconnected and paused runners and non-play phases', () => {
    const s = { ...kit.start(), world: world([runner('p1')], [obstacle('rock', 180)]) };
    expect(game.bot.sampleInput(s, '__proto__', createRng(1))).toBeNull();
    expect(
      game.bot.sampleInput({ ...s, world: world([runner('p1', { died: 0 })]) }, 'p1', createRng(1)),
    ).toBeNull();
    expect(game.bot.sampleInput(kit.player(s, 'p1', false), 'p1', createRng(1))).toBeNull();
    expect(game.bot.sampleInput(kit.vip(s, 'pause'), 'p1', createRng(1))).toBeNull();
    expect(game.bot.sampleInput(kit.vip(s, 'skip'), 'p1', createRng(1))).toBeNull();
  });
});
