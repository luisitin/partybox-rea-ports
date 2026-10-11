import { afterEach, expect, it, vi } from 'vitest';
import { readThemeColor } from './themeColor';

afterEach(() => vi.unstubAllGlobals());

it('reads a token off <html>, trimmed, and is empty without a document', () => {
  expect(readThemeColor('--pb-felt-lit')).toBe('');
  const root = {};
  vi.stubGlobal('document', { documentElement: root });
  vi.stubGlobal('getComputedStyle', (el: unknown) => ({
    getPropertyValue: (name: string) =>
      el === root && name === '--pb-felt-lit' ? ' #13704f ' : '',
  }));
  expect(readThemeColor('--pb-felt-lit')).toBe('#13704f');
  expect(readThemeColor('--nope')).toBe('');
});
