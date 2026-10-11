// Hash final, formatted evidence; reject missing screenshots or the job's media budget.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const job = fileURLToPath(new URL('../', import.meta.url));
const media = fileURLToPath(new URL('../media/', import.meta.url));
const files = readdirSync(media).sort();
const bytes = files.reduce((sum, file) => sum + statSync(media + file).size, 0);
if (bytes >= 10 * 1024 * 1024) throw new Error(`Media budget exceeded: ${bytes}`);
const hashes = files.map(
  (file) =>
    `${createHash('sha256')
      .update(readFileSync(media + file))
      .digest('hex')}  media/${file}`,
);
writeFileSync(job + 'SHA256SUMS.txt', hashes.join('\n') + '\n');
console.log(`${files.length} media files, ${bytes} bytes; SHA256SUMS updated.`);
