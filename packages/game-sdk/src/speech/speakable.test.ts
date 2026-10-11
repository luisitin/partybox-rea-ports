// toSpeakable, rule by rule (Part 00 §5.3): every example in the spec's text, plus the edges each
// rule's comment promises. `said` is what Zira reads (every part's text); `spoken` shows phonemes.
import { describe, expect, it } from 'vitest';
import type { SpeechPart } from '@partybox/shared';
import { PLAYER_TEXT_MAX, speakableName, toSpeakable } from './speakable';
import type { SpeakableOptions } from './speakable';

const EN: SpeakableOptions = { voice: 'sky', lang: 'en' };
const PLAYER: SpeakableOptions = { ...EN, playerText: true };
const said = (parts: readonly SpeechPart[]): string => parts.map((p) => p.text).join(' ');
const spoken = (parts: readonly SpeechPart[]): string =>
  parts.map((p) => ('ipa' in p ? `/${p.ipa}/` : p.text)).join(' ');
const en = (text: string, opts: SpeakableOptions = EN): string => said(toSpeakable(text, opts));

type Row = readonly [input: string, expected: string];
const table = (rows: readonly Row[], opts: SpeakableOptions = EN): void => {
  for (const [input, expected] of rows)
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      expect(en(input, opts)).toBe(expected);
    });
};

describe('rule 1: straight apostrophes, no curly quotes', () => {
  table([
    ['Norway’s fjords', 'Norways fjords'],
    ['don’t', "don't"],
    ['don´t stop', "don't stop"],
    ['it`s ʼfineʼ', "it's fine"],
    ['she said “hello”', 'she said hello'],
  ]);
});

describe('rule 2: the contractions stay as written', () => {
  const kept =
    "don't can't won't isn't it's I'm I'll I'd I've you're we're they're they've let's that's " +
    "what's who's where's there's here's he's she's o'clock ma'am y'all";
  it('keeps all 25', () => expect(en(kept)).toBe(kept));
  it('keeps them in any case', () => expect(en("It's THAT'S Let's")).toBe("It's THAT'S Let's"));
});

describe('rule 3: possessives are read as plurals (text parts)', () => {
  table([
    ["Norway's flag", 'Norways flag'],
    ["the players' scores", 'the players scores'],
    ["the 1990's", 'the nineteen nineties'],
    ["James's hat", 'Jameses hat'],
    ["Max's dog", 'Maxes dog'],
    ["Chris's car", 'Chrises car'],
    ["the church's bell", 'the churches bell'],
    ["O'Brien's pub", "O'Briens pub"],
  ]);
});

describe('rule 4: numbers as words (numbers.test.ts has the full table)', () => {
  table([
    ['1987', 'nineteen eighty-seven'],
    ['2007', 'two thousand seven'],
    ['the 1990s', 'the nineteen nineties'],
    ["the '90s", 'the nineties'],
    ['3.5', 'three point five'],
    ['21st', 'twenty-first'],
    ['50%', 'fifty percent'],
    ['$5', 'five dollars'],
    ['$1.50', 'one dollar fifty'],
    ['£1.50', 'one pound fifty'],
    ['€5', 'five euros'],
    ['10–20', 'ten to twenty'],
    ['7:30', 'seven thirty'],
    ['1/2', 'one half'],
    ['3/4', 'three quarters'],
    ['42 cats', 'forty-two cats'],
  ]);
});

describe('rule 5: symbols', () => {
  table([
    ['salt & pepper', 'salt and pepper'],
    ['2+2', 'two plus two'],
    ['me@home', 'me at home'],
    ['#1 fan', 'number one fan'],
    ['x = y', 'x equals y'],
    ['cats/dogs', 'cats or dogs'],
    ['and/or', 'and or'],
    ['*really* ~so~ [sic] {x} <y> "z" ^', 'really so sic x y z'],
    ['Ke$ha', 'Kesha'],
    ["rock 'n' roll", 'rock n roll'],
  ]);
});

describe('rule 6: abbreviations', () => {
  table([
    ['Dr. Who', 'Doctor Who'],
    ['Mr. Bean', 'Mister Bean'],
    ['Mrs. Doubtfire', 'Missus Doubtfire'],
    ['Ms. Marvel', 'Miz Marvel'],
    ['Mr Bean', 'Mister Bean'],
    ['MS Paint', 'M S Paint'],
    ['St. Louis', 'Saint Louis'],
    ['Main St.', 'Main Street'],
    ['down the st. to', 'down the Street to'],
    ['cats vs. dogs', 'cats versus dogs'],
    ['cats vs dogs', 'cats versus dogs'],
    ['apples, pears, etc.', 'apples, pears, et cetera'],
    ['pears etc. Then more', 'pears et cetera. Then more'],
    ['fruit, e.g. apples', 'fruit, for example apples'],
    ['the best, i.e. mine', 'the best, that is mine'],
    ['No. 5', 'number five'],
    ['No. I refuse', 'No. I refuse'],
  ]);
});

describe('rule 7: shouting (player text)', () => {
  table(
    [
      ["OMG THAT'S SO FUNNY", "omg that's so funny"],
      ['OMG NASA IS HERE', 'omg NASA is here'],
      ['THE U.S.A. WON', 'the U S A won'],
      ['FBI', 'F B I'],
      ['I love the FBI', 'I love the F B I'],
    ],
    PLAYER,
  );
  it('is for player text only: pack text is spelled, as the spec warns', () => {
    expect(en("OMG THAT'S SO FUNNY")).toBe("O M G THAT'S S O F U N N Y");
  });
});

describe('rule 8: acronyms', () => {
  table([
    ['U.S.A.', 'U S A'],
    ['the U.S. team', 'the U S team'],
    ['FBI', 'F B I'],
    ['NASA', 'NASA'],
    [
      'NATO UNICEF FIFA IKEA SCUBA LASER RADAR NASCAR',
      'NATO UNICEF FIFA IKEA SCUBA LASER RADAR NASCAR',
    ],
    ['BREAKING news', 'BREAKING news'],
    ['CEOs', "C E O's"],
    ['I', 'I'],
    ['MH370 and PS5', 'MH370 and PS5'],
  ]);
  it('sends letters as phonemes, so a mid-line A is not read as "uh"', () => {
    expect(toSpeakable('the NBA finals', EN)).toEqual([
      { text: 'the' },
      { ipa: 'ˈɛn bˈiː ˈeɪ', text: 'N B A' },
      { text: 'finals' },
    ]);
  });
  it('gives the British voices British letter names', () => {
    expect(spoken(toSpeakable('ZZ Top', { ...EN, voice: 'george' }))).toBe('/zˈɛd zˈɛd/ Top');
    expect(spoken(toSpeakable('ZZ Top', EN))).toBe('/zˈiː zˈiː/ Top');
  });
  it("adds the plural or possessive to the last letter's phonemes", () => {
    expect(toSpeakable("the FBI's files", EN)[1]).toEqual({
      ipa: 'ˈɛf bˈiː ˈaɪz',
      text: "F B I's",
    });
  });
});

describe('rule 9: blanks', () => {
  table([
    ['Fill in the ____ please', 'Fill in the blank please'],
    ['__ and ______', 'blank and blank'],
    ['snake_case', 'snake case'],
  ]);
});

describe('rule 10: punctuation for pacing', () => {
  table([
    ['Wait… what', 'Wait, what'],
    ['Wait... what', 'Wait, what'],
    ['yes — no', 'yes, no'],
    ['yes–no', 'yes, no'],
    ['yes - no', 'yes, no'],
    ['Paris (France) is big', 'Paris, France, is big'],
    ['Stop!!!', 'Stop!'],
    ['What?!', 'What?'],
    ['Really?!?!', 'Really?'],
    ['...and then', 'and then'],
  ]);
});

describe('rule 11: emoji and stray symbols', () => {
  table([
    ['I love 🍕 pizza', 'I love pizza'],
    ['nice 👍🏽 one', 'nice one'],
    ['go 🇺🇸 team ™', 'go team'],
    ['👨‍👩‍👧', ''],
  ]);
  it('leaves nothing to say for emoji alone', () => expect(toSpeakable('😀😀', EN)).toEqual([]));
});

describe('rule 12: stretched words (player text)', () => {
  table(
    [
      ['sooooo good', 'soo good'],
      ['NOOOO way', 'noo way'],
      ['yesss', 'yess'],
    ],
    PLAYER,
  );
  it('leaves pack text as written', () => expect(en('sooooo good')).toBe('sooooo good'));
});

describe('rule 13: player text is read to 140 characters, cut at a word', () => {
  const long = Array.from({ length: 40 }, (_, i) => `word${'x'.repeat(i % 3)}`).join(' ');
  it('cuts at a word boundary within the cap', () => {
    const text = en(long, PLAYER);
    expect(text.length).toBeLessThanOrEqual(PLAYER_TEXT_MAX);
    expect(long.startsWith(text)).toBe(true);
    expect(long[text.length]).toBe(' ');
  });
  it('cuts one enormous word hard rather than saying nothing', () => {
    expect(en('abcdefghij'.repeat(30), PLAYER)).toHaveLength(PLAYER_TEXT_MAX);
  });
  it('leaves pack text whole', () => expect(en(long)).toBe(long));
});

describe('Spanish: rules 1, 9, 10 and 11 only (the voices are English)', () => {
  it('keeps numbers, acronyms and possessives as written', () => {
    expect(toSpeakable('Hola… ¿qué tal? 😀 ____ FBI 1987 José’s', { ...EN, lang: 'es' })).toEqual([
      { text: "Hola, qué tal? blank FBI 1987 José's" },
    ]);
  });
});

describe('player names (§5.5)', () => {
  const names: readonly [string, string | null][] = [
    ['Bob', 'Bob'],
    ['xX_Slayer_Xx', 'xX Slayer Xx'],
    ['Agent 47', 'Agent 47'],
    ['Brynn', 'Brynn'],
    ['José 🎉', 'José'],
    ['Zzz', null],
    ['12345', null],
    ['x1234', null],
    ['K-9', null],
    ['😀', null],
    ['', null],
  ];
  for (const [name, expected] of names)
    it(`${JSON.stringify(name)} → ${JSON.stringify(expected)}`, () =>
      expect(speakableName(name)).toBe(expected));
});

describe('whole lines', () => {
  it('runs every rule in order on a real prompt', () => {
    expect(en('In 1987, Dr. Smith’s FBI team (all 3/4 of it) spent $1.50 & won… 🎉')).toBe(
      'In nineteen eighty-seven, Doctor Smiths F B I team, all three quarters of it, spent one dollar fifty and won',
    );
  });
  it('is deterministic and never throws on odd input', () => {
    const odd = [
      '',
      ' ',
      '\u{0}',
      '\u{E000}',
      "'",
      '$',
      '1/0',
      '99999999999999999999',
      '_'.repeat(9),
    ];
    for (const text of odd) {
      const a = toSpeakable(text, PLAYER);
      expect(toSpeakable(text, PLAYER)).toEqual(a);
      for (const p of a) expect(p.text.length).toBeGreaterThan(0);
    }
  });
});
