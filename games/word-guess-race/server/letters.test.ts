// Letter allocation invariants include duplicate-heavy words and deterministically replayed properties.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalWord, feedback } from './letters';

describe('five-letter input and duplicate allocation', () => {
  it('normalizes case and outside whitespace without accepting accents or punctuation', () => {
    expect(canonicalWord('  APPLE  ')).toBe('apple');
    expect(canonicalWord('The apple')).toBeNull();
    expect(canonicalWord('app-le')).toBeNull();
    expect(canonicalWord('ápplé')).toBeNull();
    expect(canonicalWord(' apple\n')).toBe('apple');
    expect(canonicalWord('aaaa')).toBeNull();
    expect(canonicalWord('aaaaaa')).toBeNull();
  });

  it('keeps number words as five letters in this exact-letter puzzle', () => {
    for (const word of ['three', 'seven', 'forty', 'eight']) expect(canonicalWord(word)).toBe(word);
  });

  it('reserves exact slots before assigning yellow duplicates', () => {
    expect(feedback('allee', 'apple')).toEqual([
      'correct',
      'present',
      'absent',
      'absent',
      'correct',
    ]);
    expect(feedback('eerie', 'serve')).toEqual([
      'absent',
      'correct',
      'correct',
      'absent',
      'correct',
    ]);
    expect(feedback('apple', 'apple')).toEqual(Array(5).fill('correct'));
  });

  it('limits misplaced letters to the number of unreserved answer occurrences', () => {
    expect(feedback('aaaaa', 'cacao')).toEqual([
      'absent',
      'correct',
      'absent',
      'correct',
      'absent',
    ]);
    expect(feedback('cacao', 'aaaaa')).toEqual([
      'absent',
      'correct',
      'absent',
      'correct',
      'absent',
    ]);
    expect(feedback('berry', 'robot')).toEqual([
      'present',
      'absent',
      'present',
      'absent',
      'absent',
    ]);
  });

  const word = fc
    .array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'), { minLength: 5, maxLength: 5 })
    .map((letters) => letters.join(''));
  it.each([1, 2, 3])(
    'counts each answer occurrence once, property seed %i / 1000 cases',
    (seed) => {
      fc.assert(
        fc.property(word, word, (guess, answer) => {
          const marks = feedback(guess, answer);
          expect(marks).toHaveLength(5);
          for (let i = 0; i < 5; i++) expect(marks[i] === 'correct').toBe(guess[i] === answer[i]);
          for (const letter of new Set(guess)) {
            const count = (text: string): number => [...text].filter((x) => x === letter).length;
            const used = [...guess].filter((x, i) => x === letter && marks[i] !== 'absent').length;
            expect(used).toBe(Math.min(count(guess), count(answer)));
          }
        }),
        { seed, numRuns: 1000 },
      );
    },
  );
});
