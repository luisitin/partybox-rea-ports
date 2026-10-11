// Hash the exact committed media bytes after formatting/capture.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const names = readdirSync(join(root, 'media')).sort();
let totalBytes = 0;
const hashes = names.map((name) => {
  const bytes = readFileSync(join(root, 'media', name));
  totalBytes += bytes.length;
  return `${createHash('sha256').update(bytes).digest('hex')}  media/${name}`;
});
writeFileSync(join(root, 'SHA256SUMS.txt'), hashes.join('\n') + '\n');
console.log(
  JSON.stringify({ files: names.length, totalBytes, under10MB: totalBytes < 10 * 1024 * 1024 }),
);
if (totalBytes >= 10 * 1024 * 1024) process.exitCode = 1;
