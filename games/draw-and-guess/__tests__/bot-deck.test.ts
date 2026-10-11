import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { botInput } from '../server/bot';
import { vocabulary, WORDS } from '../server/content';
import { game } from '../server/index';
import { BOT_ART } from '../server/pictures';
import type { State } from '../server/types';
import { drawing, guesser } from './helpers';

function publicMask(difficulty: string, word: string): State {
  const state = drawing();
  return {
    ...state,
    settings: { ...state.settings, difficulty },
    word,
    clock: state.began + 8000,
    hintCount: 0,
    strokes: [],
    guesses: {},
    lastGuessAt: {},
  };
}

describe('bot guesses use the public difficulty deck', () => {
  it.each([
    ['easy', 'chair', 25, 9],
    ['medium', 'crown', 7, 27],
    ['hard', 'bagel', 2, 32],
  ] as const)(
    '%s five-letter guesses stay inside the selected deck',
    (difficulty, word, count, removed) => {
      const state = publicMask(difficulty, word);
      const id = guesser(state);
      const oldCandidates = WORDS.filter((candidate) => candidate.length === 5);
      const candidates = vocabulary(difficulty).filter((candidate) => candidate.length === 5);
      expect(oldCandidates).toHaveLength(34);
      expect(candidates).toHaveLength(count);
      expect(oldCandidates.length - candidates.length).toBe(removed);
      const sampled = new Set<string>();
      for (const skill of ['easy', 'normal', 'sharp'] as const) {
        for (let seed = 1; seed <= 200; seed++) {
          const input = botInput(state, id, createRng(seed), skill);
          expect(input?.type).toBe('guess');
          if (input?.type !== 'guess') throw new Error('expected a public candidate guess');
          expect(candidates).toContain(input.text);
          sampled.add(input.text);
        }
      }
      console.info(
        'Public-deck candidate reduction:',
        JSON.stringify({
          difficulty,
          mask: '_____',
          before: 34,
          after: count,
          removed,
          sampled: sampled.size,
        }),
      );
    },
  );

  it.each(['normal', 'sharp'] as const)(
    '%s recognition cannot guess a picture excluded by the public deck',
    (skill) => {
      for (const [difficulty, word] of [
        ['medium', 'crown'],
        ['hard', 'bagel'],
      ] as const) {
        const state = { ...publicMask(difficulty, word), strokes: BOT_ART.house! };
        const id = guesser(state);
        for (let seed = 1; seed <= 40; seed++) {
          const input = botInput(state, id, createRng(seed), skill);
          expect(input?.type).toBe('guess');
          if (input?.type !== 'guess') throw new Error('expected a public candidate guess');
          expect(vocabulary(difficulty)).toContain(input.text);
          expect(input.text).not.toBe('house');
        }
      }
    },
  );

  it('still applies the public letters and the player’s own guess history inside that deck', () => {
    const state = {
      ...publicMask('medium', 'crown'),
      hintCount: 1,
      hintOrder: [0, 1, 2, 3, 4],
    };
    const id = guesser(state);
    const afterWrongGuess = { ...state, guesses: { [id]: ['clown', 'canoe'] } };
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      for (let seed = 1; seed <= 20; seed++)
        expect(botInput(afterWrongGuess, id, createRng(seed), skill)).toEqual({
          type: 'guess',
          text: 'crown',
        });
    }
    expect(
      botInput({ ...state, guesses: { [id]: ['clown', 'canoe', 'crown'] } }, id, createRng(1)),
    ).toBeNull();
  });

  it.each(['easy', 'normal', 'sharp'] as BotSkill[])(
    '%s still depends only on the public mask, ink, deck and own guesses',
    (skill) => {
      for (const [difficulty, word] of [
        ['easy', 'chair'],
        ['medium', 'crown'],
        ['hard', 'bagel'],
      ] as const) {
        const state = publicMask(difficulty, word);
        const id = guesser(state);
        const changed = { ...state, word: 'zzzzz', choices: ['private', 'secret', 'unknown'] };
        expect(game.controllerView(changed, id)).toEqual(game.controllerView(state, id));
        for (let seed = 1; seed <= 40; seed++)
          expect(botInput(changed, id, createRng(seed), skill)).toEqual(
            botInput(state, id, createRng(seed), skill),
          );
      }
    },
  );
});
