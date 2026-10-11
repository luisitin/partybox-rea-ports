import { describe, expect, it } from 'vitest';
import { readingMs, wordCount } from './index';

describe('readingMs', () => {
  it('floors at 1.5 s', () => {
    expect(readingMs(0)).toBe(1_500);
    expect(readingMs(-5)).toBe(1_500);
  });
  it('adds 333 ms a word', () => expect(readingMs(3)).toBe(2_499));
  it('ui x1.3 matches the old per-game readMs', () => {
    for (const w of [0, 1, 7, 12, 30])
      expect(readingMs(w, { ui: true })).toBe(Math.round((1_500 + w * 333) * 1.3));
  });
  it('es x1.1', () => {
    expect(readingMs(0, { lang: 'es-MX' })).toBe(1_650);
    expect(readingMs(0, { lang: 'en' })).toBe(1_500);
  });
  it('largeText x1.2', () => expect(readingMs(0, { largeText: true })).toBe(1_800));
  it('combines', () =>
    expect(readingMs(3, { ui: true, lang: 'es', largeText: true })).toBe(
      Math.round(2_499 * 1.3 * 1.1 * 1.2),
    ));
});

describe('wordCount', () => {
  it('counts whitespace-separated words', () => {
    expect(wordCount('  a  b\tc\n')).toBe(3);
    expect(wordCount('')).toBe(0);
  });
});
