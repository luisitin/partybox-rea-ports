// stem(): foundation §4.4 with the canonicalising rules of FOUNDATION-AUDIT #16. The pairs are
// what matters — singular and plural must land on the same key — so every row is a pair.
import { describe, expect, it } from 'vitest';
import { normalize } from './normalize';
import { stem, stemKey } from './stem';

// [plural, singular]: both must give the same stem. The first eight are pinned by the audit.
const englishPairs: [string, string][] = [
  ['movies', 'movie'],
  ['horses', 'horse'],
  ['knives', 'knife'],
  ['pies', 'pie'],
  ['berries', 'berry'],
  ['boxes', 'box'],
  ['wolves', 'wolf'],
  ['cats', 'cat'],
  ['glasses', 'glass'],
  ['buses', 'bus'],
  ['dishes', 'dish'],
  ['matches', 'match'],
  ['houses', 'house'],
  ['potatoes', 'potato'],
  ['toys', 'toy'],
  ['cookies', 'cookie'],
  ['cheeses', 'cheese'],
];

const spanishPairs: [string, string][] = [
  ['noches', 'noche'],
  ['luces', 'luz'],
  ['peces', 'pez'],
  ['lápices', 'lápiz'],
  ['flores', 'flor'],
  ['casas', 'casa'],
  ['leones', 'leon'],
  ['reyes', 'rey'],
  ['cafes', 'cafe'],
  ['meses', 'mes'],
  ['calles', 'calle'],
];

describe('stem — English plural and singular meet', () => {
  it.each(englishPairs)('%s = %s', (plural, singular) => {
    expect(stem(plural, 'en')).toBe(stem(singular, 'en'));
  });
});

describe('stem — Spanish plural and singular meet', () => {
  it.each(spanishPairs)('%s = %s', (plural, singular) => {
    // The matcher stems normalized words (no accents); the rows are written as players type them.
    const key = (word: string): string => stem(normalize(word, 'es').norm, 'es');
    expect(key(plural)).toBe(key(singular));
  });
});

describe('stem — the exact keys and the words left alone', () => {
  it.each([
    ['movies', 'en', 'movi'],
    ['knives', 'en', 'knif'],
    ['berry', 'en', 'berri'],
    ['glass', 'en', 'glass'], // no final s after ss
    ['virus', 'en', 'virus'], // … nor after us
    ['iris', 'en', 'iris'], // … nor after is
    ['gas', 'en', 'gas'], // plural rules need 4+ letters
    ['be', 'en', 'be'],
    ['lives', 'en', 'liv'], // "ves" → f only when 3+ letters remain
    ['21', 'en', '21'],
    ['noches', 'es', 'noch'],
    ['luces', 'es', 'luz'],
    ['mes', 'es', 'mes'],
    ['berry', 'es', 'berry'], // y → i is English only
  ] as const)('%s (%s) → %s', (word, lang, key) => {
    expect(stem(word, lang)).toBe(key);
  });

  it('stems every word of a phrase and joins the stems', () => {
    expect(stemKey('emperor penguins', 'en')).toBe('emperorpenguin');
    expect(stemKey('hot dogs', 'en')).toBe(stemKey('hot dog', 'en'));
    expect(stemKey('', 'en')).toBe('');
  });
});
