// Read-only byte provenance shared by verification tools; no game or browser execution.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const gamePath = 'games/agar-io';
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function files(directory) {
  const absolute = resolve(root, directory);
  if (!existsSync(absolute)) throw new Error(`Missing source directory: ${directory}`);
  return readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => {
      const child = `${directory}/${entry.name}`;
      return entry.isDirectory() ? files(child) : [child];
    })
    .sort();
}

export function hashes(paths) {
  return Object.fromEntries(
    [...new Set(paths)].sort().map((path) => [path, digest(readFileSync(resolve(root, path)))]),
  );
}

export function gameSources() {
  return hashes(files(gamePath));
}

export function runtimeSources() {
  // Fidelity captures and game documentation can be added during a long run.
  // The separate shipped-game ledger still binds every file for final publication.
  const scopes = ['server', 'client', 'content', '__tests__', 'fixtures'];
  return hashes(
    files(gamePath).filter(
      (path) =>
        path === `${gamePath}/manifest.json` ||
        scopes.some((scope) => path.startsWith(`${gamePath}/${scope}/`)),
    ),
  );
}

export function behaviorSources() {
  return hashes([
    `${gamePath}/manifest.json`,
    ...files(`${gamePath}/server`),
    ...files(`${gamePath}/content`),
  ]);
}

export function dependencySources() {
  // Bind the actual local SDK/shared implementation and dependency resolution,
  // rather than assuming that a prior commit or installed SDK is unchanged.
  return hashes([
    ...files('packages/game-sdk/src'),
    ...files('packages/shared/src'),
    'packages/game-sdk/package.json',
    'packages/shared/package.json',
    'package.json',
    'pnpm-lock.yaml',
    'tsconfig.base.json',
    'vitest.config.ts',
  ]);
}

export function snapshot(testFiles, full = false) {
  return Object.fromEntries(
    Object.entries({
      ...(full ? runtimeSources() : behaviorSources()),
      ...hashes(full ? [] : testFiles),
      ...dependencySources(),
    }).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function sameSources(before, after) {
  if (!before || !after) return false;
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...paths].every((path) => before[path] === after[path]);
}

export function sourceChanges(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .sort()
    .filter((path) => before[path] !== after[path])
    .map((path) => ({ path, before: before[path] ?? null, after: after[path] ?? null }));
}
