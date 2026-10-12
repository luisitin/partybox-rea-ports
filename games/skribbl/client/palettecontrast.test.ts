import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLORS } from './palette';

type Tokens = Record<string, string>;

const css = readFileSync(new URL('../../../design/tokens.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

function declarations(block: string): Tokens {
  return Object.fromEntries(
    [...block.matchAll(/(--pb-[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1]!,
      match[2]!.trim(),
    ]),
  );
}

const root = css.match(/:root\s*\{([^}]+)\}/)?.[1];
if (!root) throw new Error('The shipped default theme must declare drawing tokens.');
const defaults = declarations(root);
const themes = [
  { name: 'night', tokens: defaults },
  ...[...css.matchAll(/\[data-theme=['"]([^'"]+)['"]\]\s*\{([^}]+)\}/g)].map((match) => ({
    name: match[1]!,
    tokens: { ...defaults, ...declarations(match[2]!) },
  })),
];

function luminance(token: string, tokens: Tokens, seen: string[] = []): number {
  if (seen.includes(token)) throw new Error(`Circular drawing color token: ${token}`);
  const value = tokens[token];
  if (!value) throw new Error(`Missing drawing color token: ${token}`);
  const alias = value.match(/^var\((--pb-[\w-]+)\)$/)?.[1];
  if (alias) return luminance(alias, tokens, [...seen, token]);
  if (!/^#[\da-f]{6}$/i.test(value)) throw new Error(`Unsupported drawing color: ${value}`);
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

it('checks all five shipped themes', () => {
  expect(themes.length).toBeGreaterThanOrEqual(5);
});

describe.each(themes)('$name drawing palette', ({ tokens }) => {
  it.each(COLORS)('$name ink remains visible against the drawing paper', ({ token }) => {
    const ink = luminance(token, tokens);
    const paper = luminance('--pb-bg', tokens);
    const contrast = (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(3);
  });
});
