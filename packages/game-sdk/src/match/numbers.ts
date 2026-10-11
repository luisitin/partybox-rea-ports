// Number words up to ninety-nine become digits (foundation §4.3 step 6), so "twenty-one", "21"
// and "veintiuno" are one answer. Works on the word list normalize() has already folded
// (lowercase, no accents: "dieciséis" arrives as "dieciseis"), after the leading article is gone
// (FOUNDATION-AUDIT #15: Spanish "una" is an article first, so "una piñata" stays "pinata").
import type { MatchLang } from './types';

const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const EN_TEENS = [
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const EN_TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

// Spanish writes 16-29 as one word; "veintiún" / "veintiuna" are the forms before a noun.
const ES_SINGLE: Record<string, number> = {
  cero: 0,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};
const ES_TENS: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};
// After "treinta y": "un" and "una" are numbers here, never articles.
const ES_UNITS: Record<string, number> = {
  uno: 1,
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
};

interface NumberWords {
  /** One word, one value: "seven", "nineteen", "twentyone", "veintidos". */
  single: Map<string, number>;
  tens: Map<string, number>;
  units: Map<string, number>;
  /** The word between tens and units: Spanish "treinta y uno"; English has none. */
  joiner: string | null;
}

function buildEnglish(): NumberWords {
  const single = new Map<string, number>();
  const units = new Map<string, number>();
  EN_UNITS.forEach((word, n) => {
    single.set(word, n);
    if (n > 0) units.set(word, n);
  });
  EN_TEENS.forEach((word, n) => single.set(word, 10 + n));
  const tens = new Map<string, number>();
  EN_TENS.forEach((word, i) => {
    const value = 20 + 10 * i;
    tens.set(word, value);
    single.set(word, value);
    // "twentyone": the hyphen was dropped instead of spaced.
    for (const [unit, n] of units) single.set(word + unit, value + n);
  });
  return { single, tens, units, joiner: null };
}

function buildSpanish(): NumberWords {
  const single = new Map(Object.entries(ES_SINGLE));
  const tens = new Map(Object.entries(ES_TENS));
  for (const [word, value] of tens) single.set(word, value);
  return { single, tens, units: new Map(Object.entries(ES_UNITS)), joiner: 'y' };
}

const WORDS: Record<MatchLang, NumberWords> = { en: buildEnglish(), es: buildSpanish() };

/** Replaces number words in `words` with digits: ["twenty", "one", "pilots"] → ["21", "pilots"]. */
export function numberWordsToDigits(words: readonly string[], lang: MatchLang): string[] {
  const { single, tens, units, joiner } = WORDS[lang];
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i] as string;
    const ten = tens.get(word);
    if (ten !== undefined) {
      // "twenty one" (English) or "treinta y uno" (Spanish): one number, not two.
      const unitAt = joiner === null ? i + 1 : i + 2;
      const unit = units.get(words[unitAt] ?? '');
      if (unit !== undefined && (joiner === null || words[i + 1] === joiner)) {
        out.push(String(ten + unit));
        i = unitAt;
        continue;
      }
    }
    const value = single.get(word);
    out.push(value === undefined ? word : String(value));
  }
  return out;
}
