// The string rules of toSpeakable (Part 00 §5.3), one function each, in the spec's order. Rules 4
// (numbers.ts), 8 (acronyms, which make phoneme parts) and 13 (the length cap, over parts) live
// with the pipeline in speakable.ts. Text frozen by an override or by rule 8 sits in the string as
// one private-use character, which no rule here changes or removes. Pure.

/** Rule 2: kept as written — rule 3 would make "it's" "its" and "let's" "lets". */
// prettier-ignore
export const CONTRACTIONS: ReadonlySet<string> = new Set([
  "don't", "can't", "won't", "isn't", "it's", "i'm", "i'll", "i'd", "i've", "you're", "we're",
  "they're", "they've", "let's", "that's", "what's", "who's", "where's", "there's", "here's",
  "he's", "she's", "o'clock", "ma'am", "y'all",
]);

/** Rule 8's say-as-word list: never spelled, and kept in capitals when rule 7 calms a shout. */
// prettier-ignore
export const SAY_AS_WORD: ReadonlySet<string> = new Set([
  'NASA', 'NATO', 'UNICEF', 'FIFA', 'IKEA', 'SCUBA', 'LASER', 'RADAR', 'NASCAR',
]);

/** Placeholders for frozen parts (speakable.ts); removed from input so nobody can forge one. */
export const MARKS = /[\u{E000}-\u{F8FF}]/gu;
/** "U.S.A.", "P.M.": capitals with dots, which only rule 8 undoes. */
const DOTTED = /^(?:\p{Lu}\.)+\p{Lu}\.?$/u;
const EDGE = '(?<![\\p{L}\\p{N}])';

/** Rule 1: straight apostrophes, no curly double quotes (the commonest cause of mangled words).
 *  Also NFC, so "Beyoncé" typed either way meets its override. */
export function straighten(text: string): string {
  return text
    .normalize('NFC')
    .replace(MARKS, '')
    .replace(/[’‘ʼ´`]/g, "'")
    .replace(/[“”]/g, '');
}

/** Rule 3 on text: possessives as plurals — they sound the same, and plurals read reliably. */
export function possessivesToPlurals(text: string): string {
  return text
    .replace(/([\p{L}\p{N}]+(?:'\p{L}+)*)'s(?![\p{L}\p{N}])/gu, (m, word: string) => {
      if (CONTRACTIONS.has(m.toLowerCase())) return m;
      return /(?:s|x|z|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`;
    })
    .replace(/(?<=[\p{L}\p{N}][sS])'(?![\p{L}\p{N}])/gu, '');
}

/** Rule 5: symbols a reader says as words; any other symbol goes (rule 11 sweeps what is left).
 *  Underscores, parentheses and dashes stay for rules 9 and 10. */
export function symbolsToWords(text: string): string {
  return text
    .replace(/(?<![\p{L}])and\/or(?![\p{L}])/giu, 'and or')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s*\+\s*/g, ' plus ')
    .replace(/\s*@\s*/g, ' at ')
    .replace(/\s*=\s*/g, ' equals ')
    .replace(/(?<=\p{L})\$(?=\p{L})/gu, 's') // Ke$ha
    .replace(/(?<=\p{L})\s*\/\s*(?=\p{L})/gu, ' or ')
    .replace(/[*^~|\\<>[\]{}"#$%/]/g, ' ')
    .replace(/(?<!\p{L})'|'(?!\p{L})/gu, ' '); // a quote mark, not an apostrophe in a word
}

const TITLES: Readonly<Record<string, string>> = {
  dr: 'Doctor',
  mr: 'Mister',
  mrs: 'Missus',
  ms: 'Miz',
};

/** Rule 6. "No. 5" is read with the numbers (rule 4), since it needs the digit. */
export function abbreviations(text: string): string {
  const re = (source: string, flags = 'giu'): RegExp => new RegExp(`${EDGE}${source}`, flags);
  return (
    text
      .replace(re('(dr|mr|mrs|ms)\\.'), (_, t: string) => TITLES[t.toLowerCase()]!)
      // "Mr Bean" without the dot, but only before a name: "MS Paint" and "dr" stay.
      .replace(
        re('(Dr|Mr|Mrs|Ms)(?=\\s+\\p{Lu})', 'gu'),
        (_, t: string) => TITLES[t.toLowerCase()]!,
      )
      .replace(re('[Ss]t\\.(?=\\s+\\p{Lu})', 'gu'), 'Saint')
      .replace(re('[Ss]t\\.', 'gu'), 'Street')
      .replace(re('vs\\.?(?![\\p{L}\\p{N}])'), 'versus')
      // A sentence that ended on "etc." keeps its full stop. (No `i` flag here: with it, \p{Lu}
      // matches lowercase letters too.)
      .replace(re('[Ee]tc\\.?(\\s+(?=\\p{Lu}))?', 'gu'), (_, ws?: string) =>
        ws ? `et cetera.${ws}` : 'et cetera',
      )
      .replace(re('e\\.g\\.?(?![\\p{L}\\p{N}])'), 'for example')
      .replace(re('i\\.e\\.?(?![\\p{L}\\p{N}])'), 'that is')
  );
}

/** Rule 7 (player text): a line more than half capitals is a shout, and a voice would spell it
 *  letter by letter — lowercase it, keeping the say-as-word acronyms and dotted ones. A lone word
 *  ("FBI") is an acronym, not a shout. */
export function calmShouting(text: string): string {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const capitals = text.match(/\p{Lu}/gu)?.length ?? 0;
  const words = text.match(/\p{L}+/gu)?.length ?? 0;
  if (words < 2 || capitals * 2 <= letters) return text;
  return text.replace(/[\p{L}\p{N}.']+/gu, (token) =>
    SAY_AS_WORD.has(token.replace(/\.+$/, '')) || DOTTED.test(token) ? token : token.toLowerCase(),
  );
}

/** Rule 8, first half: U.S.A. → USA (rule 8's second half, in speakable.ts, spells it). */
export function undotAcronyms(text: string): string {
  return text.replace(
    /(?<![\p{L}\p{N}])((?:\p{Lu}\.)+\p{Lu})\.?(?![\p{L}\p{N}])/gu,
    (_, run: string) => run.replace(/\./g, ''),
  );
}

/** Rule 9: a blank to fill (two or more underscores) is read "blank". */
export function blanks(text: string): string {
  return text.replace(/_{2,}/g, ' blank ');
}

/** Rule 10: punctuation as pauses — ellipses, dashes between words and parentheses are commas. */
export function pacing(text: string): string {
  return text
    .replace(/\s*(?:…|\.{3,}|(?:\.\s){2,}\.)\s*/g, ', ')
    .replace(/\s*(?:—|–|--)\s*|\s+-\s+/g, ', ')
    .replace(/\s*[()]\s*/g, ', ')
    .replace(/[!?]{2,}/g, (run) => (run.includes('?') ? '?' : '!'));
}

/** Rule 11: emoji and stray symbols go (the screen still shows them). What stays: letters, marks,
 *  digits, spaces, . , ! ? ; : ' - and the frozen parts' placeholders. */
export function dropEmoji(text: string): string {
  return text
    .replace(
      /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u{200D}\u{FE0E}\u{FE0F}\u{20E3}]/gu,
      ' ',
    )
    .replace(/[^\p{L}\p{M}\p{N}\s.,!?;:'\-\u{E000}-\u{F8FF}]/gu, ' ');
}

/** Rule 12 (player text): "sooooo" → "soo"; a stretched shout is lowercased as well ("NOOOO"). */
export function unstretch(text: string): string {
  return text.replace(/[\p{L}']+/gu, (token) => {
    if (!/(\p{L})\1\1/u.test(token)) return token;
    const short = token.replace(/(\p{L})\1{2,}/gu, '$1$1');
    return /^[\p{Lu}']+$/u.test(token) ? short.toLowerCase() : short;
  });
}

const STRENGTH = ',:;.!?';

/** One space between words, none before a mark, one mark where rules left several (the
 *  strongest: "et cetera.," → "."), no mark leading and no pause trailing ("won… 🎉"). */
export function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/[,.!?;:](?:\s*[,.!?;:])+/g, (run) =>
      [...run.replace(/\s/g, '')].reduce((a, b) =>
        STRENGTH.indexOf(b) > STRENGTH.indexOf(a) ? b : a,
      ),
    )
    .replace(/^[\s,.!?;:]+|[\s,;:]+$/g, '');
}
