// normalize(text, lang): the one form every matcher step compares (foundation §4.3 as corrected
// by FOUNDATION-AUDIT #15 and #25-#27). Deterministic on every machine: String#normalize and
// String#toLowerCase follow the Unicode tables, never the host's locale — no Intl, no toLocale*
// (a Turkish locale would lowercase "I" to a dotless "ı").
import { numberWordsToDigits } from './numbers';
import type { MatchLang } from './types';

export interface Normalized {
  /** Words separated by single spaces: "ice cream". Empty when nothing is left. */
  norm: string;
  /** `norm` without its spaces: "icecream". What exact matching and the pack dedupe compare. */
  compact: string;
}

/**
 * A regex character class from code points and [first, last] ranges. Written as numbers because
 * several of these characters are invisible or look like their ASCII twins (‐ vs -, ’ vs ').
 */
function charClass(points: readonly (number | readonly [number, number])[]): RegExp {
  const esc = (cp: number): string => `\\u{${cp.toString(16)}}`;
  const body = points
    .map((p) => (typeof p === 'number' ? esc(p) : `${esc(p[0])}-${esc(p[1])}`))
    .join('');
  return new RegExp(`[${body}]`, 'gu');
}

/**
 * Apostrophes and quotes of every kind: " ' ` ´, ‘ ’ ‚ ‛ “ ” „ ‟, ′ ″ ‵, ʹ ʺ ʻ ʼ ʽ, « » ‹ ›, and
 * the fullwidth " '. Removed, not spaced ("don't" → "dont"), and removed BEFORE NFKD (#25): NFKD
 * turns ´ into a space plus a combining accent, so "don´t" would have become "don t".
 */
const QUOTES = charClass([
  0x22,
  0x27,
  0x60,
  0xb4,
  [0x2018, 0x201f],
  [0x2032, 0x2033],
  0x2035,
  [0x2b9, 0x2bd],
  0xab,
  0xbb,
  0x2039,
  0x203a,
  0xff02,
  0xff07,
]);

/** Combining marks left by NFKD: é → e + U+0301, ñ → n + U+0303. Also drops emoji modifiers. */
const MARKS = /\p{M}/gu;

/**
 * Letters NFKD does not decompose (#26): without this "straße" became "stra e". Applied after
 * lowercasing, so Ø Æ Œ Ł Đ Þ and capital ẞ fold through their lowercase forms.
 */
const FOLD: Record<string, string> = {
  ß: 'ss',
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ł: 'l',
  đ: 'd',
  þ: 'th',
  ı: 'i', // dotless i
};
const FOLDABLE = new RegExp(`[${Object.keys(FOLD).join('')}]`, 'g');

/**
 * Become spaces: hyphen-minus, the Unicode hyphens and dashes (U+2010-2015) and minus sign,
 * underscore, slash, backslash, the fraction and division slashes (NFKD writes ½ as 1⁄2), dot
 * and comma.
 */
const SEPARATORS = charClass([
  0x2d,
  [0x2010, 0x2015],
  0x2212,
  0x5f,
  0x2f,
  0x5c,
  0x2044,
  0x2215,
  0x2e,
  0x2c,
]);

/** Whatever is left that is not a letter, a digit or a space: symbols, emoji, joiners. */
const SYMBOLS = /[^\p{L}\p{N}\s]/gu;

const ARTICLES: Record<MatchLang, ReadonlySet<string>> = {
  en: new Set(['the', 'a', 'an']),
  es: new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']),
};

const AND: Record<MatchLang, string> = { en: ' and ', es: ' y ' };

/** Lowercase, accent- and punctuation-free words, one leading article dropped, numbers as digits. */
export function normalize(text: string, lang: MatchLang): Normalized {
  const cleaned = text
    .replace(QUOTES, '')
    .normalize('NFKD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(FOLDABLE, (ch) => FOLD[ch] ?? ch)
    .replace(/&/g, AND[lang])
    .replace(/\+/g, ' plus ')
    .replace(SEPARATORS, ' ')
    .replace(SYMBOLS, '')
    .trim();
  if (cleaned === '') return { norm: '', compact: '' };
  const words = cleaned.split(/\s+/);
  // One article, and only when a word follows it (#27): a lone "the" stays "the", not "".
  // Before the number words (#15): Spanish "una piñata" is an article, not the number one.
  if (words.length > 1 && ARTICLES[lang].has(words[0] as string)) words.shift();
  const final = numberWordsToDigits(words, lang);
  return { norm: final.join(' '), compact: final.join('') };
}
