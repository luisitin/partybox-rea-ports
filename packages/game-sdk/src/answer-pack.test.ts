// The §4.9 pack test (checkAnswerPack) and the answer-item schema, on a good and a bad fixture.
import { describe, expect, it } from 'vitest';
import { answerItemSchema, checkAnswerPack } from './answer-pack';
import bad from './fixtures/answer-pack.bad.json';
import good from './fixtures/answer-pack.good.json';

describe('checkAnswerPack — a good pack', () => {
  it('passes, and warns only for the common word with under 3 accepts', () => {
    expect(checkAnswerPack(good)).toEqual({
      ok: true,
      errors: [],
      warnings: [
        'animals-axolotl: "axolotl" has 1 accepted form(s); a common word wants 6 or more',
      ],
    });
  });

  it('lets the game say which words are common', () => {
    const report = checkAnswerPack(good, {
      isCommon: (item) => Number(item['weight'] ?? 50) >= 10,
    });
    expect(report.warnings).toEqual([]);
  });

  it('reads every entry in the pack’s language', () => {
    const items = [{ id: 'song', answer: 'la bamba', accept: ['bamba', 'labamba', 'la vamba'] }];
    const tail =
      'after normalization ("%s"): spacing, case, accent and apostrophe variants are automatic';
    // Spanish drops "la", so "bamba" is the answer again; English keeps it, so "labamba" is.
    expect(checkAnswerPack({ lang: 'es', items }).errors).toEqual([
      `song accept "bamba" equals song answer "la bamba" ${tail.replace('%s', 'bamba')}`,
    ]);
    expect(checkAnswerPack({ lang: 'en', items }).errors).toEqual([
      `song accept "labamba" equals song answer "la bamba" ${tail.replace('%s', 'labamba')}`,
    ]);
  });
});

describe('checkAnswerPack — a bad pack', () => {
  const report = checkAnswerPack(bad);
  const expected = [
    // #28: spacing and hyphen variants are automatic, so listing them is a clash
    'food-ice-cream accept "icecream" equals food-ice-cream answer "ice cream"',
    'food-ice-cream accept "ice-cream" equals food-ice-cream answer "ice cream"',
    // an accept its own reject blocks never matches
    'animals-horse accept "hose" matches its own item as "none", not "exact"',
    // number words are digits
    'numbers-021 accept "twenty-one" equals numbers-021 answer "21"',
    'numbers-021 accept "!!!" is empty after normalization',
    // clashes across items: an article does not make a new answer
    'colours-orange answer "the orange" equals fruit-orange answer "orange"',
    'colours-orange accept "tangerine" equals fruit-orange accept "tangerine"',
    'food-ice-cream: the id is used twice',
    'food-ice-cream answer "gelato" equals food-ice-cream accept "gelato"',
  ];

  it('fails', () => {
    expect(report.ok).toBe(false);
    expect(report.warnings).toEqual([]);
  });

  it.each(expected)('reports: %s', (message) => {
    expect(report.errors.some((error) => error.startsWith(message))).toBe(true);
  });

  it('reports nothing else', () => {
    expect(report.errors).toHaveLength(expected.length);
  });
});

describe('checkAnswerPack — schema errors', () => {
  it.each([
    ['no lang', { items: [] }, 'lang:'],
    ['an unknown lang', { lang: 'fr', items: [] }, 'lang:'],
    ['uppercase', { lang: 'en', items: [{ id: 'a', answer: 'Penguin' }] }, 'items.0.answer:'],
    ['a bad id', { lang: 'en', items: [{ id: 'Animals 1', answer: 'cat' }] }, 'items.0.id:'],
    [
      'a short family root',
      { lang: 'en', items: [{ id: 'a', answer: 'cat', family: ['ca'] }] },
      'items.0.family.0:',
    ],
    ['not a pack', 'penguin', '(pack):'],
  ])('fails on %s', (_label, pack, path) => {
    const report = checkAnswerPack(pack);
    expect(report.ok).toBe(false);
    expect(report.errors[0]).toContain(path);
  });

  it('defaults the lists and keeps a game’s own fields', () => {
    expect(answerItemSchema.parse({ id: 'hm-1', answer: 'cheese', weight: 18 })).toEqual({
      id: 'hm-1',
      answer: 'cheese',
      accept: [],
      reject: [],
      family: [],
      weight: 18,
    });
  });
});
