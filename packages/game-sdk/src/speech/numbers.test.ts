// Rule 4 (Part 00 §5.3): numbers to words, straight through readNumbers (the other rules off).
import { describe, expect, it } from 'vitest';
import { cardinal, numberWords, ordinal, readNumbers, yearWords } from './numbers';

type Row = readonly [input: string, expected: string];
const table = (rows: readonly Row[]): void => {
  for (const [input, expected] of rows)
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () =>
      expect(readNumbers(input)).toBe(expected));
};

describe('cardinal, ordinal and year words', () => {
  it('says integers the American way', () => {
    expect(cardinal(0)).toBe('zero');
    expect(cardinal(13)).toBe('thirteen');
    expect(cardinal(42)).toBe('forty-two');
    expect(cardinal(105)).toBe('one hundred five');
    expect(cardinal(4200)).toBe('four thousand two hundred');
    expect(cardinal(1_000_000)).toBe('one million');
    expect(cardinal(7_000_000_021)).toBe('seven billion twenty-one');
  });
  it('makes ordinals from the last word', () => {
    const cases: [number, string][] = [
      [1, 'first'],
      [2, 'second'],
      [3, 'third'],
      [5, 'fifth'],
      [8, 'eighth'],
      [9, 'ninth'],
      [12, 'twelfth'],
      [20, 'twentieth'],
      [21, 'twenty-first'],
      [100, 'one hundredth'],
    ];
    for (const [n, word] of cases) expect(ordinal(n)).toBe(word);
  });
  it('reads 1100–2099 as years', () => {
    expect(yearWords(1987)).toBe('nineteen eighty-seven');
    expect(yearWords(1905)).toBe('nineteen oh five');
    expect(yearWords(1900)).toBe('nineteen hundred');
    expect(yearWords(1100)).toBe('eleven hundred');
    expect(yearWords(2000)).toBe('two thousand');
    expect(yearWords(2007)).toBe('two thousand seven');
    expect(yearWords(2010)).toBe('twenty ten');
    expect(yearWords(2099)).toBe('twenty ninety-nine');
  });
  it('reads a leading zero or a very long number digit by digit', () => {
    expect(numberWords('007')).toBe('zero zero seven');
    expect(numberWords('1234567890123456')).toBe(
      'one two three four five six seven eight nine zero one two three four five six',
    );
  });
});

describe('years and decades', () => {
  table([
    ['in 1987', 'in nineteen eighty-seven'],
    ['in 2007', 'in two thousand seven'],
    ['in 2024', 'in twenty twenty-four'],
    ['in 1099', 'in one thousand ninety-nine'],
    ['in 2100', 'in two thousand one hundred'],
    ['1,987 people', 'one thousand nine hundred eighty-seven people'],
    ['the 1990s', 'the nineteen nineties'],
    ["the '90s", 'the nineties'],
    ['the 80s', 'the eighties'],
    ['the 1900s', 'the nineteen hundreds'],
    ['the 2000s', 'the two thousands'],
    ['roll 6s', 'roll sixes'],
  ]);
});

describe('integers, decimals, ordinals, percent', () => {
  table([
    ['42', 'forty-two'],
    ['1,000,000 fans', 'one million fans'],
    ['3.5', 'three point five'],
    ['0.25', 'zero point two five'],
    ['.5', 'point five'],
    ['21st', 'twenty-first'],
    ['the 2nd, 3rd and 4th', 'the second, third and fourth'],
    ['50%', 'fifty percent'],
    ['12.5 %', 'twelve point five percent'],
    ['-5 degrees', 'minus five degrees'],
    ['it was -5', 'it was minus five'],
    ['#1', 'number one'],
    ['No. 5', 'number five'],
  ]);
});

describe('money', () => {
  table([
    ['$5', 'five dollars'],
    ['$1', 'one dollar'],
    ['$1.50', 'one dollar fifty'],
    ['$2.99', 'two dollars ninety-nine'],
    ['$0.99', 'ninety-nine cents'],
    ['$0.01', 'one cent'],
    ['$5.00', 'five dollars'],
    ['$4,000', 'four thousand dollars'],
    ['$1999', 'one thousand nine hundred ninety-nine dollars'],
    ['£1.50', 'one pound fifty'],
    ['£0.50', 'fifty pence'],
    ['€5', 'five euros'],
    ['€2.50', 'two euros fifty'],
    ['$5 million', 'five million dollars'],
    ['$1.5M', 'one point five million dollars'],
    ['$10k', 'ten thousand dollars'],
  ]);
});

describe('ranges, times, fractions', () => {
  table([
    ['10–20', 'ten to twenty'],
    ['10-20', 'ten to twenty'],
    ['1990–1995', 'nineteen ninety to nineteen ninety-five'],
    ['$10–$20', 'ten dollars to twenty dollars'],
    ['won 3-2', 'won three to two'],
    ['7:30', 'seven thirty'],
    ['7:05', 'seven oh five'],
    ['7:00', "seven o'clock"],
    ['0:01', 'zero oh one'],
    ['7pm', 'seven P.M.'],
    ['7:30 a.m.', 'seven thirty A.M.'],
    ['1/2', 'one half'],
    ['3/4', 'three quarters'],
    ['1/4', 'one quarter'],
    ['2/3', 'two thirds'],
    ['5/8', 'five eighths'],
    ['24/7', 'twenty-four seven'],
    ['9/11', 'nine eleven'],
    ['50/50', 'fifty fifty'],
    ['3/4/2024', 'three four twenty twenty-four'],
    ['½ cup', ' one half  cup'],
    ['1½ cups', 'one and one half cups'],
  ]);
});

describe('digits inside a word are left to the voice (or an override)', () => {
  table([
    ['PS5', 'PS5'],
    ['5G', '5G'],
    ['MH370', 'MH370'],
    ['401k', '401k'],
    // A hyphen is a word boundary: the number after it is read.
    ['COVID-19', 'COVID-nineteen'],
    ['a B-52', 'a B-fifty-two'],
  ]);
});
