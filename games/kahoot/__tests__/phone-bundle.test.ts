// I-752 C: phone code must never pull the content library into the phone download. Walks every
// non-type import reachable from client/ and fails if one reaches server/content or a content JSON.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory()
      ? files(p)
      : /\.tsx?$/.test(f) && !/\.test\./.test(f)
        ? [p]
        : [];
  });
const resolveImport = (from: string, spec: string): string | null => {
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')])
    if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
};
const valueImports = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/^import\s+(?!type\b)[^;]*?from\s+'(\.[^']+)'/gm)].map(
    (m) => m[1] as string,
  );

describe('I-752 C: the phone download carries no content', () => {
  it('no client file reaches server/content or a content JSON', () => {
    const seen = new Set<string>();
    const bad: string[] = [];
    const walk = (file: string, via: string[]): void => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const spec of valueImports(file)) {
        if (
          spec.endsWith('.json') ||
          /server\/content$/.test(resolve(dirname(file), spec).replace(/\\/g, '/'))
        ) {
          bad.push([...via, file, spec].join(' -> '));
          continue;
        }
        const next = resolveImport(file, spec);
        if (next) walk(next, [...via, file]);
      }
    };
    for (const f of files(join(GAME, 'client'))) walk(f, []);
    expect(bad).toEqual([]);
  });
});
