// isLegalClue: foundation §4.7 with FOUNDATION-AUDIT #31 and ruling 16 (a hyphenated clue is one
// word; the length is the raw trimmed text in code points; reason codes only).
import { describe, expect, it } from 'vitest';
import { CLUE_MAX_CHARS, isLegalClue } from './clue';
import type { ClueOptions, ClueReason } from './clue';
import type { MatchItem } from './types';

const sunflower: MatchItem = {
  answer: 'sunflower',
  accept: ['sun flower', 'sunflowers'],
  family: ['sun', 'flower'],
};
const penguin: MatchItem = {
  answer: 'penguin',
  accept: ['penguins', 'emperor penguin'],
  reject: ['puffin'],
  family: ['pengu'],
};
const girasol: MatchItem = { answer: 'girasol', family: ['sol'] };
const seven: MatchItem = { answer: '7', accept: ['seven'] };

const en: ClueOptions = { lang: 'en' };
const one: ClueOptions = { lang: 'en', oneWord: true };
const es: ClueOptions = { lang: 'es', oneWord: true };

const rows: [string, MatchItem | null, ClueOptions, ClueReason | 'ok'][] = [
  // empty: nothing left after normalizing
  ['', sunflower, en, 'empty'],
  ['   ', sunflower, en, 'empty'],
  ['!!!', sunflower, en, 'empty'],
  ['🌻', sunflower, en, 'empty'],
  // too-long: raw trimmed text, code points, default 20
  ['a'.repeat(CLUE_MAX_CHARS), sunflower, en, 'ok'],
  ['a'.repeat(CLUE_MAX_CHARS + 1), sunflower, en, 'too-long'],
  [`  ${'b'.repeat(CLUE_MAX_CHARS)}  `, sunflower, en, 'ok'], // trimmed first
  ['ñandú-ñandú-ñandú-ñandú', sunflower, en, 'too-long'], // 23 code points
  ['petals', sunflower, { lang: 'en', maxChars: 5 }, 'too-long'],
  // not-one-word: whitespace in the raw text; a hyphen joins
  ['ice-cream', sunflower, one, 'ok'],
  ['extraordinarily-long', sunflower, one, 'ok'], // 20 code points, one word
  ['ice cream', sunflower, one, 'not-one-word'],
  ['ice cream', sunflower, en, 'ok'],
  // is-secret: matchAnswer says stem or better
  ['SUNFLOWER', sunflower, one, 'is-secret'],
  ['sun-flower', sunflower, one, 'is-secret'],
  ['sunflowers', sunflower, one, 'is-secret'],
  ['penguins', penguin, one, 'is-secret'],
  ['seven', seven, one, 'is-secret'], // number words are digits
  // contains-secret: the answer or a 3+ letter family root inside the clue, or a 4+ letter clue
  // inside the answer
  ['sunflowerz', sunflower, one, 'contains-secret'], // only fuzzy, still contains the word
  ['sunny', sunflower, one, 'contains-secret'],
  ['flowery', sunflower, one, 'contains-secret'],
  ['flow', sunflower, one, 'contains-secret'],
  ['pengu', penguin, one, 'contains-secret'],
  ['owe', sunflower, one, 'ok'], // inside "sunflower", but under 4 letters
  ['petals', sunflower, one, 'ok'],
  ['yellow', sunflower, one, 'ok'],
  ['puffin', penguin, one, 'ok'], // a reject is another thing, a fair clue
  ['emperor', penguin, one, 'ok'], // inside an accept, not inside the answer
  // no secret: a player who does not know it is never checked against it (§4.7)
  ['penguin', null, one, 'ok'],
  ['ice cream', null, one, 'not-one-word'],
  ['', null, one, 'empty'],
  // Spanish
  ['soleado', girasol, es, 'contains-secret'],
  ['girasoles', girasol, es, 'is-secret'],
  ['el girasol', girasol, { lang: 'es' }, 'is-secret'],
  ['amarillo', girasol, es, 'ok'],
];

describe('isLegalClue', () => {
  it.each(rows)('%j for %o (%o) → %s', (clue, secret, opts, expected) => {
    const verdict = isLegalClue(clue, secret, opts);
    expect(verdict).toEqual(expected === 'ok' ? { ok: true } : { ok: false, reason: expected });
  });
});
