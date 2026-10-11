// Rule 4 of toSpeakable (Part 00 §5.3): numbers as a person says them. The voices read digits on
// their own, but badly where it matters: espeak says "$1.50" as "dollar one point five zero",
// "3/4" as "three slash four" and "1990s" as "nineteen hundred ninety z" (measured through the
// Kokoro sidecar's phonemiser, 2026-09-24). Pure; American wording ("one hundred five", no "and").

// prettier-ignore
const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', ' thousand', ' million', ' billion', ' trillion'];
const IRREGULAR_ORDINALS: Readonly<Record<string, string>> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
};
const CURRENCY: Readonly<Record<string, readonly [string, string, string, string]>> = {
  $: ['dollar', 'dollars', 'cent', 'cents'],
  '£': ['pound', 'pounds', 'penny', 'pence'],
  '€': ['euro', 'euros', 'cent', 'cents'],
};
const MAGNITUDES: Readonly<Record<string, string>> = {
  thousand: 'thousand',
  million: 'million',
  billion: 'billion',
  trillion: 'trillion',
  k: 'thousand',
  m: 'million',
  mn: 'million',
  b: 'billion',
  bn: 'billion',
};
const VULGAR: Readonly<Record<string, string>> = {
  '½': 'one half',
  '¼': 'one quarter',
  '¾': 'three quarters',
  '⅓': 'one third',
  '⅔': 'two thirds',
};

/** Not inside a word: "5" in "PS5" or "5G" stays for the voice (or an override). */
const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';
/** An amount: 4,000 · 1.50 · 7 · .5 */
const AMOUNT = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|\\.\\d+)';

const digitsAloud = (digits: string): string => [...digits].map((d) => ONES[Number(d)]).join(' ');

function under1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const out: string[] = hundreds ? [`${ONES[hundreds]} hundred`] : [];
  if (rest >= 20)
    out.push(`${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ''}`);
  else if (rest) out.push(ONES[rest]!);
  return out.join(' ');
}

/** 0 … 999 trillion as words ("four thousand two hundred"). */
export function cardinal(n: number): string {
  if (n === 0) return 'zero';
  const groups: string[] = [];
  for (let scale = 0; n > 0; scale++, n = Math.floor(n / 1000))
    if (n % 1000) groups.unshift(`${under1000(n % 1000)}${SCALES[scale]}`);
  return groups.join(' ');
}

/** 21 → "twenty-first". */
export function ordinal(n: number): string {
  const words = cardinal(n);
  const cut = Math.max(words.lastIndexOf(' '), words.lastIndexOf('-')) + 1;
  const last = words.slice(cut);
  const said =
    IRREGULAR_ORDINALS[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return words.slice(0, cut) + said;
}

/** 1100–2099 as years are said: "nineteen eighty-seven", "two thousand seven", "twenty ten". */
export function yearWords(n: number): string {
  if (n >= 2000 && n <= 2009) return cardinal(n);
  const low = n % 100;
  const high = cardinal(Math.floor(n / 100));
  if (low === 0) return `${high} hundred`;
  return `${high} ${low < 10 ? `oh ${ONES[low]}` : cardinal(low)}`;
}

/** "nineteen ninety" → "nineteen nineties"; "six" → "sixes". */
function plural(words: string): string {
  if (words.endsWith('y')) return `${words.slice(0, -1)}ies`;
  return /[sx]$/.test(words) ? `${words}es` : `${words}s`;
}

/** A written amount as words: a four-digit 1100–2099 is a year unless `plain`; 007 digit by digit. */
export function numberWords(raw: string, plain = false): string {
  const [int = '', frac] = raw.replace(/,/g, '').split('.');
  let words = '';
  if ((int.length > 1 && int.startsWith('0')) || int.length > 15) words = digitsAloud(int);
  else if (int) {
    const n = Number(int);
    const year = !plain && frac === undefined && !raw.includes(',') && n >= 1100 && n <= 2099;
    words = year ? yearWords(n) : cardinal(n);
  }
  return frac === undefined ? words : `${words} point ${digitsAloud(frac)}`.trim();
}

function money(symbol: string, amount: string, magnitude: string | undefined): string {
  const [one, many, cent, cents] = CURRENCY[symbol]!;
  const scale = magnitude ? MAGNITUDES[magnitude.toLowerCase()] : undefined;
  if (scale) return `${numberWords(amount, true)} ${scale} ${many}`;
  const [int = '', frac = ''] = amount.replace(/,/g, '').split('.');
  if (frac.length > 2) return `${numberWords(amount, true)} ${many}`;
  const whole = Number(int || '0');
  const sub = Number(frac.padEnd(2, '0') || '0');
  if (whole === 0 && sub > 0) return `${cardinal(sub)} ${sub === 1 ? cent : cents}`;
  const main = `${numberWords(int || '0', true)} ${whole === 1 ? one : many}`;
  return sub ? `${main} ${cardinal(sub)}` : main;
}

function fraction(top: number, bottom: number): string {
  const name = bottom === 2 ? 'half' : bottom === 4 ? 'quarter' : ordinal(bottom);
  const named = top === 1 ? name : bottom === 2 ? 'halves' : `${name}s`;
  return `${cardinal(top)} ${named}`;
}

function clock(hour: string, minute: string | undefined, meridiem: boolean): string {
  const h = cardinal(Number(hour));
  const m = Number(minute ?? '0');
  if (m === 0) return meridiem ? h : `${h} o'clock`;
  return `${h} ${m < 10 ? `oh ${ONES[m]}` : cardinal(m)}`;
}

const re = (source: string, flags = 'gu'): RegExp => new RegExp(source, flags);

/** Rule 4, in the order that keeps each pattern from eating another's digits. */
export function readNumbers(text: string): string {
  return (
    text
      .replace(re(`(\\d+)\\s?([${Object.keys(VULGAR).join('')}])`), (_, n: string, v: string) => {
        return `${numberWords(n, true)} and ${VULGAR[v]}`;
      })
      .replace(re(`[${Object.keys(VULGAR).join('')}]`), (v) => ` ${VULGAR[v]} `)
      // "#1" and "No. 5" (rules 5 and 6) need the digits, so they are read here.
      .replace(re(`#(?=\\d)|${B}No\\.\\s?(?=\\d)`, 'giu'), 'number ')
      // Ranges and scores: 10–20, 3-2, $10–$20 → "to".
      .replace(/(?<=\d)\s?[–—-]\s?(?=[$£€]?\.?\d)/gu, ' to ')
      // A minus starts a word: "COVID-19" is not "COVID minus nineteen", even once COVID is frozen.
      .replace(/(?<![^\s([])[-−](?=[$£€]?\.?\d)/gu, 'minus ')
      .replace(
        re(`${B}(\\d{1,2})(?::([0-5]\\d))?\\s?([ap])\\.?m\\.?${E}`, 'giu'),
        // P.M. with dots: rule 7 keeps a dotted acronym when it lowercases a shout; rule 8 spells it.
        (_, h: string, m: string | undefined, ap: string) =>
          `${clock(h, m, true)} ${ap.toUpperCase()}.M.`,
      )
      .replace(
        re(
          `([$£€])\\s?${AMOUNT}(?:\\s(thousand|million|billion|trillion)|(k|m|mn|bn|b))?${E}`,
          'giu',
        ),
        (_, sym: string, amount: string, word?: string, suffix?: string) =>
          money(sym, amount, word ?? suffix),
      )
      .replace(
        re(`${B}${AMOUNT}\\s?%`),
        (_, amount: string) => `${numberWords(amount, true)} percent`,
      )
      .replace(re(`${B}([01]?\\d|2[0-3]):([0-5]\\d)(?![\\p{N}:])`), (_, h: string, m: string) =>
        clock(h, m, false),
      )
      .replace(re(`${B}'?(\\d+)s${E}`), (_, n: string) => plural(numberWords(n)))
      .replace(re(`${B}(\\d{1,3}(?:,\\d{3})+|\\d+)(st|nd|rd|th)${E}`, 'giu'), (_, n: string) =>
        ordinal(Number(n.replace(/,/g, ''))),
      )
      .replace(/(?<![\p{L}\p{N}/])(\d+)\/(\d+)(?![\p{L}\p{N}/])/gu, (_, a: string, b: string) => {
        const top = Number(a);
        const bottom = Number(b);
        // 3/4 is a fraction; 24/7, 9/11 and 50/50 are said as two numbers.
        return top >= 1 && top < bottom && bottom <= 10
          ? fraction(top, bottom)
          : `${numberWords(a, true)} ${numberWords(b, true)}`;
      })
      .replace(/(?<=\d)\/(?=\d)/g, ' ') // a date's slashes: 3/4/2024 is three numbers
      .replace(re(`${B}${AMOUNT}${E}`), (n) => numberWords(n))
  );
}
