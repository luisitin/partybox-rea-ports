// normalize(): foundation §4.3 with FOUNDATION-AUDIT #15, #25-#27. Each row is [input, norm];
// the compact form is always norm without spaces (checked once for every row).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalize } from './normalize';

/** Characters that are invisible or look like ASCII, spelled by code point. */
const ch = (cp: number): string => String.fromCodePoint(cp);

const english: [string, string][] = [
  // apostrophes and quotes: removed before NFKD (#25)
  ["don't", 'dont'],
  ["O'Neill", 'oneill'],
  [`don${ch(0xb4)}t`, 'dont'], // acute accent as an apostrophe: NFKD would have made "don t"
  [`don${ch(0x2019)}t`, 'dont'], // right single quotation mark (phone keyboards)
  [`rock${ch(0x2bc)}n${ch(0x2bc)}roll`, 'rocknroll'], // modifier letter apostrophe
  [`${ch(0x201c)}quoted${ch(0x201d)}`, 'quoted'],
  [`${ch(0xab)}Jaws${ch(0xbb)}`, 'jaws'],
  ['"Jaws"', 'jaws'],
  ['`tick`', 'tick'],
  // case and accents
  ['PENGUIN', 'penguin'],
  ['Café', 'cafe'],
  ['naïve', 'naive'],
  ['Pokémon', 'pokemon'],
  ['crème brûlée', 'creme brulee'],
  // the fold table NFKD leaves alone (#26)
  ['Straße', 'strasse'],
  ['STRAẞE', 'strasse'],
  ['Ørsted', 'orsted'],
  ['Æon', 'aeon'],
  ['œuvre', 'oeuvre'],
  ['Łódź', 'lodz'],
  ['Đorđe', 'dorde'],
  ['Þór', 'thor'],
  ['ılık', 'ilik'],
  ['İstanbul', 'istanbul'],
  // & and +, separators, symbols, emoji
  ['Rock & Roll', 'rock and roll'],
  ['Disney+', 'disney plus'],
  ['ice-cream', 'ice cream'],
  [`ice${ch(0x2013)}cream`, 'ice cream'], // en dash
  [`ice${ch(0xa0)}cream`, 'ice cream'], // no-break space
  ['ice_cream/cone.', 'ice cream cone'],
  [ch(0xbd), '1 2'], // ½: NFKD gives 1, the fraction slash, 2
  ['AC/DC', 'ac dc'],
  ['Mr.Bean', 'mr bean'],
  ['1,000', '1 000'],
  ['wow!!!', 'wow'],
  ['C#', 'c'],
  ['pizza 🍕', 'pizza'],
  ['👍🏽', ''],
  ['?!', ''],
  ['  Hello \t  World  ', 'hello world'],
  // one leading article, only when a word follows (#27)
  ['The Beatles', 'beatles'],
  ['a cat', 'cat'],
  ['an owl', 'owl'],
  ['the the', 'the'],
  ['The', 'the'],
  ['A', 'a'],
  ['la bamba', 'la bamba'], // a Spanish article means nothing in English
  // number words up to 99 (articles first, #15)
  ['twenty-one', '21'],
  ['twenty one', '21'],
  ['twentyone', '21'],
  ['The Twenty One Pilots', '21 pilots'],
  ['ninety nine', '99'],
  ['zero', '0'],
  ['seven dwarfs', '7 dwarfs'],
  ['one hundred', '1 hundred'],
  ['a hundred', 'hundred'],
];

const spanish: [string, string][] = [
  ['una piñata', 'pinata'], // un/una are articles first (#15)
  ['un gato', 'gato'],
  ['El Niño', 'nino'],
  ['Los Ángeles', 'angeles'],
  ['una', 'una'],
  ['uno', '1'],
  ['veintiuno', '21'],
  ['veintiún', '21'],
  ['veintidós', '22'],
  ['dieciséis', '16'],
  ['treinta y uno', '31'],
  ['treinta y una', '31'],
  ['noventa & nueve', '99'],
  ['cero', '0'],
  ['pan & mantequilla', 'pan y mantequilla'],
  ['Año nuevo', 'ano nuevo'],
  ['¿Qué?', 'que'],
];

describe('normalize — English', () => {
  it.each(english)('%j → %j', (input, norm) => {
    expect(normalize(input, 'en')).toEqual({ norm, compact: norm.replaceAll(' ', '') });
  });
});

describe('normalize — Spanish', () => {
  it.each(spanish)('%j → %j', (input, norm) => {
    expect(normalize(input, 'es')).toEqual({ norm, compact: norm.replaceAll(' ', '') });
  });
});

describe('normalize — compounds share a compact form', () => {
  it.each([
    ['ice cream', 'icecream', 'ice-cream'],
    ['star fish', 'starfish', 'Star_Fish'],
    ['twenty one', '21', 'twenty-one'],
  ])('%j = %j = %j', (a, b, c) => {
    const forms = [a, b, c].map((text) => normalize(text, 'en').compact);
    expect(new Set(forms).size).toBe(1);
  });
});

// Turkish lowercases I to a dotless ı and İ to i; the matcher must not care where it runs.
const TURKISH = ['ISPARTA', 'İstanbul', 'DİYARBAKIR', 'Iğdır', 'ılık', 'KIŞ'];
const TURKISH_NORM = ['isparta', 'istanbul', 'diyarbakir', 'igdir', 'ilik', 'kis'];

describe('normalize — the machine locale never matters', () => {
  it('gives the same output with LANG=tr_TR in this process', () => {
    const saved = process.env['LANG'];
    process.env['LANG'] = 'tr_TR';
    try {
      expect(TURKISH.map((text) => normalize(text, 'en').norm)).toEqual(TURKISH_NORM);
    } finally {
      if (saved === undefined) delete process.env['LANG'];
      else process.env['LANG'] = saved;
    }
    // The inputs do exercise the hazard: a Turkish-aware lowercase would have kept a dotless ı.
    expect('ISPARTA'.toLocaleLowerCase('tr')).not.toBe(TURKISH_NORM[0]);
  });

  it('gives the same output in a child process started under a Turkish locale', () => {
    const source = new URL('./normalize.ts', import.meta.url).href;
    const script = `import { normalize } from ${JSON.stringify(source)};
      console.log(JSON.stringify(${JSON.stringify(TURKISH)}.map((t) => normalize(t, 'en').norm)));`;
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', script],
      {
        cwd: fileURLToPath(new URL('../../../..', import.meta.url)),
        env: { ...process.env, LANG: 'tr_TR.UTF-8', LC_ALL: 'tr_TR.UTF-8' },
        encoding: 'utf8',
      },
    );
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual(TURKISH_NORM);
  });
});
