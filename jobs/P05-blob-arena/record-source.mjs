// CI evidence identifies the complete game tree without changing tracked files.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(resolve(root, 'games/agar-io'));
const ledger = files.sort().map((path) => ({
  path: relative(root, path).replaceAll('\\', '/'),
  sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
}));
console.log(JSON.stringify({ game: 'agar-io', sourceFiles: ledger.length, ledger }));
