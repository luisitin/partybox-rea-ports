// Hash each retained media file and check the job's 10 MB budget, without extra processes.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const job = fileURLToPath(new URL('./', import.meta.url));
const media = join(job, 'media');
const files = readdirSync(media)
  .filter((name) => statSync(join(media, name)).isFile())
  .sort();
let bytes = 0;
const lines = files.map((name) => {
  const body = readFileSync(join(media, name));
  bytes += body.length;
  return `${createHash('sha256').update(body).digest('hex')}  media/${name}`;
});
if (bytes >= 10_000_000) throw new Error(`Media exceeds 10 MB: ${bytes}`);
writeFileSync(join(job, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log(`${files.length} media files, ${bytes} bytes, all SHA-256 hashes recorded`);
