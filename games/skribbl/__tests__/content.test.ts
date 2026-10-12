import { describe, expect, it } from 'vitest';
import { normalize } from '@partybox/game-sdk/match';
import { packs, wordPackSchema } from '../content/schema';
import { DECKS, WORDS, vocabulary } from '../server/content';
import { game } from '../server/index';
import { testPlayers } from '@partybox/game-sdk/testing';
import { T0 } from './helpers';

describe('original vocabulary', () => {
  it('ships three valid 100-word decks with 300 distinct normalized answers', () => {
    expect(Object.keys(packs).sort()).toEqual(['easy', 'hard', 'medium']);
    expect(WORDS).toHaveLength(300);
    expect(new Set(WORDS.map((word) => normalize(word, 'en').compact)).size).toBe(300);
    for (const [difficulty, words] of Object.entries(DECKS)) {
      expect(words).toHaveLength(100);
      expect(wordPackSchema.safeParse(words).success).toBe(true);
      expect(vocabulary(difficulty)).toEqual(words);
    }
    expect(vocabulary('mixed')).toEqual(WORDS);
  });

  it('rejects incomplete, duplicate and malformed word packs', () => {
    const easy = [...DECKS.easy!];
    for (const bad of [
      easy.slice(0, 99),
      [...easy, 'extra'],
      easy.map(() => 'cat'),
      ['BAD!', ...easy.slice(1)],
    ]) {
      expect(wordPackSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('only offers words from the selected difficulty to human drawers', () => {
    for (const difficulty of Object.keys(DECKS)) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = game.init({ players: testPlayers(4), settings: { difficulty }, seed, now: T0 });
        expect(s.choices.every((word) => DECKS[difficulty]!.includes(word))).toBe(true);
      }
    }
  });
});
