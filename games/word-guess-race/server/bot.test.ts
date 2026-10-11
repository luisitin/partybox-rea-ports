// Bot decisions may depend on their own clues and the public dictionary, never the current solution.
import { createRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { candidates } from './bot';
import { ACCEPTED, ANSWERS } from './content';
import { game } from './index';
import { feedback } from './letters';
import type { State } from './types';

const kit = testKit(game, { players: testPlayers(2), inputAt: 1000 });
const skills = ['easy', 'normal', 'sharp'] as const;

describe('three honest solver strengths', () => {
  it('candidate elimination follows duplicate feedback exactly and never repeats a failed guess', () => {
    const history = [{ word: 'allee', marks: feedback('allee', 'apple') }];
    expect(candidates(history)).toContain('apple');
    expect(
      candidates(history).every(
        (word) => feedback('allee', word).join() === history[0]!.marks.join(),
      ),
    ).toBe(true);
    expect(candidates([{ word: 'apple', marks: Array(5).fill('correct') }])).toEqual([]);
  });

  it.each(skills)("%s never reads secret solutions or another player's history", (skill) => {
    const state = kit.start();
    const expected = game.bot.sampleInput(state, 'p1', createRng(8), skill);
    const blinded: State = {
      ...state,
      entries: {
        ...state.entries,
        p2: {
          ...state.entries.p2!,
          guesses: [{ word: 'apple', marks: Array(5).fill('correct') }],
          solvedElapsedMs: 1,
        },
      },
    };
    Object.defineProperty(blinded, 'answers', {
      get: () => {
        throw new Error('A bot read a secret solution.');
      },
    });
    expect(game.bot.sampleInput(blinded, 'p1', createRng(8), skill)).toEqual(expected);
    const clues = {
      ...state,
      entries: {
        ...state.entries,
        p1: {
          ...state.entries.p1!,
          guesses: [{ word: 'crane', marks: feedback('crane', 'apple') }],
        },
      },
    };
    const next = game.bot.sampleInput(clues, 'p1', createRng(8), skill);
    expect(next).not.toBeNull();
    expect(next!.word).not.toBe('crane');
    expect(candidates(clues.entries.p1!.guesses)).toContain(next!.word);
  });

  it.each(skills)(
    '%s emits only schema-valid dictionary guesses and stops for finished/nonplaying seats',
    (skill) => {
      let state = { ...kit.start(), answers: ['apple', 'berry', 'chair'] };
      for (let i = 0; i < 6; i++) {
        const input = game.bot.sampleInput(state, 'p1', createRng(i + 1), skill);
        if (input === null) break;
        expect(game.inputSchema.safeParse(input).success).toBe(true);
        expect(ACCEPTED).toContain(input.word);
        expect(input.round).toBe(state.round);
        state = kit.input(state, 'p1', input, state.began + 1000 + i * 500);
      }
      expect(game.bot.sampleInput(state, 'p1', createRng(1), skill)).toBeNull();
      expect(game.bot.sampleInput(kit.vip(state, 'skip'), 'p2', createRng(1), skill)).toBeNull();
      const active = kit.start();
      expect(game.bot.sampleInput(kit.vip(active, 'pause'), 'p1', createRng(1), skill)).toBeNull();
      expect(
        game.bot.sampleInput(kit.player(active, 'p1', false), 'p1', createRng(1), skill),
      ).toBeNull();
      expect(game.bot.sampleInput(active, '__proto__', createRng(1), skill)).toBeNull();
    },
  );

  it('easy openings vary by the passed RNG while all solvers begin inside the public answer pool', () => {
    const state = kit.start();
    const openings = new Set(
      Array.from(
        { length: 20 },
        (_, seed) => game.bot.sampleInput(state, 'p1', createRng(seed), 'easy')!.word,
      ),
    );
    expect(openings.size).toBeGreaterThan(5);
    for (const skill of skills)
      expect(ANSWERS).toContain(game.bot.sampleInput(state, 'p1', createRng(3), skill)!.word);
  });
});
