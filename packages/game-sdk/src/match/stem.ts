// stem(word, lang): a light, rule-based stemmer with no dictionary (foundation §4.4 as corrected
// by FOUNDATION-AUDIT #16). The stems are keys, not words: they only need singular and plural to
// land on the same string, so the rules canonicalise both sides — the plural rule strips the
// ending, then a final "e" goes (and in English a final "y" becomes "i"). Without that, pairs
// such as movies/movie ("movy" vs "movie") and noches/noche never met.
import type { MatchLang } from './types';

/** Plural rules only touch words of 4+ letters: "bus", "gas" and Spanish "mes" stay whole. */
const PLURAL_MIN = 4;
/** The final-e and y→i rules only touch words of 3+ letters: "pie" → "pi", but "be" stays. */
const TAIL_MIN = 3;

/** The first English plural ending that fits, stripped. */
function englishSingular(s: string): string {
  if (s.length < PLURAL_MIN) return s;
  // berries → berri, movies → movi (the y → i below meets them: berry → berri)
  if (s.endsWith('ies')) return `${s.slice(0, -3)}i`;
  // knives → knif, wolves → wolf; only with 3+ letters left, so "lives" is not "lif"
  if (s.endsWith('ves') && s.length - 3 >= 3) return `${s.slice(0, -3)}f`;
  // boxes → box, dishes → dish, horses → hors (and horse → hors below)
  if (/(s|x|z|ch|sh)es$/.test(s)) return s.slice(0, -2);
  // cats → cat; glass, virus and iris keep their s
  if (s.endsWith('s') && !/(ss|us|is)$/.test(s)) return s.slice(0, -1);
  return s;
}

/** The first Spanish plural ending that fits, stripped. */
function spanishSingular(s: string): string {
  if (s.length < PLURAL_MIN) return s;
  // luces → luz, lápices → lapiz
  if (s.endsWith('ces')) return `${s.slice(0, -3)}z`;
  // noches → noch (and noche → noch below), flores → flor, reyes → rey
  if (/[^aeiou]es$/.test(s)) return s.slice(0, -2);
  // casas → casa
  if (s.endsWith('s')) return s.slice(0, -1);
  return s;
}

/** A final "e" goes: movie → movi, horse → hors, noche → noch. */
function dropFinalE(s: string): string {
  return s.length >= TAIL_MIN && s.endsWith('e') ? s.slice(0, -1) : s;
}

/** The stem of one normalized word: "movies" and "movie" both give "movi". */
export function stem(word: string, lang: MatchLang): string {
  if (lang === 'es') return dropFinalE(spanishSingular(word));
  const s = dropFinalE(englishSingular(word));
  // berry → berri, to meet berries → berri
  return s.length >= TAIL_MIN && s.endsWith('y') ? `${s.slice(0, -1)}i` : s;
}

/** Every word of a `norm` stemmed and joined without spaces: the key the `stem` level compares. */
export function stemKey(norm: string, lang: MatchLang): string {
  if (norm === '') return '';
  return norm
    .split(' ')
    .map((word) => stem(word, lang))
    .join('');
}
