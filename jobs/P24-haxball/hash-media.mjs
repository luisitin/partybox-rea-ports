// Run after final capture and formatting. No dependency or browser is required.
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const job = dirname(fileURLToPath(import.meta.url));
const media = join(job, 'media');
const entries = (await readdir(media, { withFileTypes: true })).sort((a, b) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
);
if (entries.some((entry) => !entry.isFile())) throw new Error('Unexpected non-file media entry');
const screensPath = join(media, 'screens.json');
const screens = JSON.parse(await readFile(screensPath, 'utf8'));
for (const screen of screens.screens) screen.bytes = (await stat(join(media, screen.file))).size;
await writeFile(screensPath, `${JSON.stringify(screens, null, 2)}\n`, 'utf8');

let bytes = 0;
const hashes = [];
for (const entry of entries) {
  const data = await readFile(join(media, entry.name));
  bytes += data.length;
  hashes.push(`${createHash('sha256').update(data).digest('hex')}  media/${entry.name}`);
}
if (bytes >= 10_000_000) throw new Error(`Media exceeds the strict 10 MB budget: ${bytes}`);
await writeFile(join(job, 'SHA256SUMS.txt'), `${hashes.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ files: entries.length, bytes, limitBytes: 10_000_000 }));
