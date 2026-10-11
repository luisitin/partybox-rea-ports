// matchAnswer / sameAnswer / groupAnswers: foundation §4.5-4.6 with FOUNDATION-AUDIT #29-#30
// and ruling 16 (rejects block stem and fuzzy matches too; digits never fuzz).
import { describe, expect, it } from 'vitest';
import { fuzzAllowance, groupAnswers, matchAnswer, sameAnswer } from './answer';
import type { MatchItem, MatchLang, MatchLevel } from './types';

const penguin: MatchItem = {
  answer: 'penguin',
  accept: ['penguins', 'pengiun', 'penquin', 'pinguin', 'penguine', 'emperor penguin'],
  reject: ['puffin', 'pelican'],
};
const horse: MatchItem = { answer: 'horse', reject: ['hose'] };
const movie: MatchItem = { answer: 'movie' };
const iceCream: MatchItem = { answer: 'ice cream', accept: ['gelato'] };
const orwell: MatchItem = { answer: '1984', accept: ['nineteen eighty four'] };
const apollo: MatchItem = { answer: 'apollo 13' };
const television: MatchItem = { answer: 'television', accept: ['tv', 'telly'] };
const car: MatchItem = { answer: 'car', reject: ['cat'] };
const noche: MatchItem = { answer: 'noche' };
const luz: MatchItem = { answer: 'luz' };
const pinata: MatchItem = { answer: 'piñata' };
const elefante: MatchItem = { answer: 'elefante' };
const bamba: MatchItem = { answer: 'bamba' };

const rows: [string, MatchItem, MatchLang, MatchLevel][] = [
  // exact: case, punctuation, articles and spacing are free
  ['Penguin', penguin, 'en', 'exact'],
  ['PENGUINS!', penguin, 'en', 'exact'],
  ['the penguin', penguin, 'en', 'exact'],
  ['Emperor-Penguin', penguin, 'en', 'exact'],
  ['icecream', iceCream, 'en', 'exact'],
  ['Ice-Cream', iceCream, 'en', 'exact'],
  ['TV', television, 'en', 'exact'],
  ['Apollo Thirteen', apollo, 'en', 'exact'],
  ['nineteen eighty-four', orwell, 'en', 'exact'],
  // stem: plurals of the answer or of an accept
  ['emperor penguins', penguin, 'en', 'stem'],
  ['horses', horse, 'en', 'stem'],
  ['movies', movie, 'en', 'stem'],
  ['ice creams', iceCream, 'en', 'stem'],
  ['cars', car, 'en', 'stem'],
  ['pies', { answer: 'pie' }, 'en', 'stem'],
  ['knives', { answer: 'knife' }, 'en', 'stem'],
  // fuzzy: within the allowance of the closest target
  ['penguns', penguin, 'en', 'fuzzy'],
  ['pengwin', penguin, 'en', 'fuzzy'],
  ['horsse', horse, 'en', 'fuzzy'],
  ['moive', movie, 'en', 'fuzzy'], // a swap is one edit (OSA)
  ['icecreams', iceCream, 'en', 'fuzzy'],
  ['televison', television, 'en', 'fuzzy'],
  ['appolo 13', apollo, 'en', 'fuzzy'], // same digits: the letters may fuzz
  // rejects block every level (#29, ruling 16)
  ['puffin', penguin, 'en', 'none'],
  ['Puffin!', penguin, 'en', 'none'],
  ['puffins', penguin, 'en', 'none'], // by stem
  ['pelicans', penguin, 'en', 'none'],
  ['hose', horse, 'en', 'none'],
  ['hoses', horse, 'en', 'none'],
  ['house', horse, 'en', 'none'], // one edit from horse, but as close to "hose"
  ['cat', car, 'en', 'none'],
  // digits never fuzz; short targets never fuzz
  ['1985', orwell, 'en', 'none'],
  ['apollo 12', apollo, 'en', 'none'],
  ['cab', car, 'en', 'none'],
  ['tele', television, 'en', 'none'],
  ['', penguin, 'en', 'none'],
  ['!!!', penguin, 'en', 'none'],
  // Spanish
  ['Noche', noche, 'es', 'exact'],
  ['una piñata', pinata, 'es', 'exact'],
  ['veintiuno', { answer: '21' }, 'es', 'exact'],
  ['noches', noche, 'es', 'stem'],
  ['luces', luz, 'es', 'stem'],
  ['piñatas', pinata, 'es', 'stem'],
  ['elefant', elefante, 'es', 'stem'],
  ['pinyata', pinata, 'es', 'fuzzy'],
  ['elefamte', elefante, 'es', 'fuzzy'],
  ['veintidós', { answer: '21' }, 'es', 'none'],
  // the language decides which articles drop
  ['la bamba', bamba, 'es', 'exact'],
  ['la bamba', bamba, 'en', 'none'],
];

describe('matchAnswer', () => {
  it.each(rows)('%j vs %o (%s) → %s', (input, item, lang, level) => {
    expect(matchAnswer(input, item, lang)).toBe(level);
  });
});

describe('fuzzAllowance', () => {
  it.each([
    [1, 0],
    [4, 0],
    [5, 1],
    [7, 1],
    [8, 2],
    [11, 2],
    [12, 3],
    [30, 3],
  ])('%i letters → %i edits', (length, edits) => {
    expect(fuzzAllowance(length)).toBe(edits);
  });
});

describe('sameAnswer', () => {
  it.each([
    ['penguins', 'Penguin', 'en', true], // stems
    ['ice cream', 'icecream', 'en', true], // compact
    ['twenty one', '21', 'en', true],
    ['pengiun', 'penguin', 'en', true], // 6+ letters, one edit
    ['penguins', 'pengiun', 'en', false], // two edits: not transitive
    ['cat', 'cot', 'en', false], // under 6 letters: no edits
    ['hose', 'horse', 'en', false],
    ['blink 182', 'blink 183', 'en', false], // digits never fuzz
    ['', '', 'en', false], // empty texts are never the same
    ['noches', 'noche', 'es', true],
    ['luces', 'luz', 'es', true],
  ] as const)('%j ~ %j (%s) → %s', (a, b, lang, same) => {
    expect(sameAnswer(a, b, lang)).toBe(same);
    expect(sameAnswer(b, a, lang)).toBe(same);
  });
});

describe('groupAnswers', () => {
  const entries = ['penguins', 'Pengiun', 'penguin', 'cat', 'cats', '', 'CAT'];

  it('closes sameAnswer chains: stems, compact forms and one edit', () => {
    expect(groupAnswers(entries, 'en')).toEqual([[0, 1, 2], [3, 4, 6], [5]]);
  });

  it('is deterministic: groups follow submission order, repeat calls agree', () => {
    const reversed = [...entries].reverse();
    expect(groupAnswers(reversed, 'en')).toEqual([[0, 2, 3], [1], [4, 5, 6]]);
    expect(groupAnswers(entries, 'en')).toEqual(groupAnswers(entries, 'en'));
  });

  it('puts every sameAnswer pair in one group', () => {
    const texts = [
      'colour',
      'color',
      'colours',
      'horse',
      'horses',
      'hose',
      'house',
      'mouse',
      '1984',
    ];
    const groupOf = new Map<number, number>();
    groupAnswers(texts, 'en').forEach((group, g) => group.forEach((i) => groupOf.set(i, g)));
    for (let i = 0; i < texts.length; i++)
      for (let j = 0; j < texts.length; j++)
        if (sameAnswer(texts[i] as string, texts[j] as string, 'en'))
          expect(groupOf.get(i), `${texts[i]} ~ ${texts[j]}`).toBe(groupOf.get(j));
  });

  it('handles no entries and Spanish', () => {
    expect(groupAnswers([], 'en')).toEqual([]);
    expect(groupAnswers(['las noches', 'noche', 'luz', 'luces'], 'es')).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});
