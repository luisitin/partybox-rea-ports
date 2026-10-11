import { describe, expect, it } from 'vitest';
import { seedRng } from '@partybox/game-sdk';
import { matchAnswer } from '@partybox/game-sdk/match';
import { WORDS, choicesFor } from '../server/content';
import { wordsSchema } from '../content/schema';
import { drawnCategory, sketchFor } from '../server/sketch';

describe('original drawable vocabulary', () => {
  it('ships 300 unique validated words, 100 in each difficulty', () => {
    expect(wordsSchema.safeParse(WORDS).success).toBe(true);
    expect(WORDS).toHaveLength(300);
    expect(new Set(WORDS.map((word) => word.id)).size).toBe(300);
    expect(new Set(WORDS.map((word) => word.text)).size).toBe(300);
    for (const difficulty of ['easy', 'medium', 'hard'])
      expect(WORDS.filter((word) => word.difficulty === difficulty)).toHaveLength(100);
    for (const word of WORDS)
      for (const alias of word.aliases)
        expect(matchAnswer(alias, { answer: word.text, accept: word.aliases }, 'en')).toBe('exact');
  });

  it('chooses three unused words until the configured pool is exhausted', () => {
    for (const difficulty of ['easy', 'medium', 'hard', 'mixed']) {
      const [first] = choicesFor(seedRng(123), difficulty, []);
      const [next] = choicesFor(
        seedRng(123),
        difficulty,
        first.map((word) => word.id),
      );
      expect(next).toHaveLength(3);
      for (const word of next) expect(first.map((item) => item.id)).not.toContain(word.id);
      const used = WORDS.filter(
        (word) => difficulty === 'mixed' || word.difficulty === difficulty,
      ).map((word) => word.id);
      const [recycled] = choicesFor(seedRng(123), difficulty, used);
      expect(recycled).toHaveLength(3);
      expect(new Set(recycled.map((word) => word.id)).size).toBe(3);
    }
  });

  it('bot art is a public category silhouette with bounded coordinate strokes', () => {
    for (const word of WORDS) {
      const strokes = sketchFor(word).map((points, index) => ({
        points,
        seq: index,
        id: index,
        color: 0,
        size: 5 as const,
      }));
      expect(strokes.length).toBeGreaterThan(0);
      for (const stroke of strokes)
        for (const [x, y] of stroke.points) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(1000);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(600);
        }
      expect(drawnCategory(strokes)).toBe(word.category);
    }
  });
});
