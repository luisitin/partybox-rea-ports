// Letters said one by one, and the phonemes around them. A spelled-out acronym goes to the voice as
// phonemes with its letters beside it (`{ ipa, text: 'F B I' }`): espeak reads a lone "A" between
// other letters as the article — "the N B A finals" came out "N B uh" — so Kokoro gets each
// letter's name as espeak itself says it at the end of a line, and Zira gets the letters.
import type { SpeechPart } from '@partybox/shared';

/** Letter names as espeak says them for the American voices (2026-09-24, the sidecar's phonemiser). */
const LETTERS_US: Readonly<Record<string, string>> = {
  A: 'ˈeɪ',
  B: 'bˈiː',
  C: 'sˈiː',
  D: 'dˈiː',
  E: 'ˈiː',
  F: 'ˈɛf',
  G: 'dʒˈiː',
  H: 'ˈeɪtʃ',
  I: 'ˈaɪ',
  J: 'dʒˈeɪ',
  K: 'kˈeɪ',
  L: 'ˈɛl',
  M: 'ˈɛm',
  N: 'ˈɛn',
  O: 'ˈoʊ',
  P: 'pˈiː',
  Q: 'kjˈuː',
  R: 'ˈɑːɹ',
  S: 'ˈɛs',
  T: 'tˈiː',
  U: 'jˈuː',
  V: 'vˈiː',
  W: 'dˈʌbəljˌuː',
  X: 'ˈɛks',
  Y: 'wˈaɪ',
  Z: 'zˈiː',
};
/** Where the British voices differ ("zed"). */
const LETTERS_GB: Readonly<Record<string, string>> = { O: 'ˈəʊ', R: 'ˈɑː', Z: 'zˈɛd' };
/** The reader voices that speak en-gb (packages/server/src/speech.ts `KOKORO`). */
const BRITISH: ReadonlySet<string> = new Set(['george', 'fable']);

/** Every symbol Kokoro v1.0 knows (kokoro_onnx config.json `vocab`); it silently drops the rest. */
const KOKORO_VOCAB = new Set(
  ';:,.!?—…"()“” \u{303}ʣʥʦʨᵝꭧAIOQSTWYᵊabcdefhijklmnopqrstuvwxyzɑɐɒæβɔɕçɖðʤəɚɛɜɟɡɥɨɪʝɯɰŋɳɲɴøɸθœɹɾɻʁɽʂʃʈʧʊʋʌɣɤχʎʒʔˈˌːʰʲ↓→↗↘ᵻ',
);

/** Symbols in `ipa` that Kokoro would drop without a word (audit #49): an override's pack test
 *  asserts this is empty, since a dropped symbol garbles the reading instead of failing. */
export function unknownPhonemes(ipa: string): string[] {
  return [...new Set([...ipa].filter((c) => !KOKORO_VOCAB.has(c)))];
}

/** The phonemes of `'s` after a word ending in `ipa`: "ɪz" after a hiss (Jameses, F B I's is "z"),
 *  "s" after a voiceless stop, "z" otherwise — what a reader would say. */
export function possessivePhonemes(ipa: string): string {
  const last = ipa.replace(/[\sˈˌːʰʲ.,!?;:—…"()]+$/u, '').slice(-1);
  if ('szʃʒʧʤ'.includes(last)) return 'ɪz';
  return 'ptkfθ'.includes(last) ? 's' : 'z';
}

/** "FBI" → `{ ipa: 'ˈɛf bˈiː ˈaɪ', text: 'F B I' }`; a plural or possessive "s" rides on the last
 *  letter ("C E O's"). Only A–Z; `spellParts` handles digits. */
export function spelled(letters: string, voice: string, possessive = false): SpeechPart {
  const gb = BRITISH.has(voice);
  const up = [...letters.toUpperCase()].filter((c) => LETTERS_US[c]);
  const ipa = up.map((c) => (gb ? (LETTERS_GB[c] ?? LETTERS_US[c]) : LETTERS_US[c])).join(' ');
  const text = up.join(' ');
  if (!possessive) return { ipa, text };
  return { ipa: `${ipa}${possessivePhonemes(ipa)}`, text: `${text}'s` };
}

/** An override's `spell: true`: letter runs as phonemes, digit runs as their own words ("PS5"). */
export function spellParts(
  token: string,
  voice: string,
  digits: (d: string) => string,
): SpeechPart[] {
  return (token.match(/[A-Za-z]+|\d+/g) ?? []).map((run) =>
    /\d/.test(run) ? { text: digits(run) } : spelled(run, voice),
  );
}
