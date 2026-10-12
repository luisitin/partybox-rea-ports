// Run after formatting generated evidence so checksums describe the committed bytes.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const job = import.meta.dirname;
const media = resolve(job, 'media');
const files = readdirSync(media).sort();
const bytes = files.reduce((sum, file) => sum + statSync(resolve(media, file)).size, 0);
if (bytes >= 10 * 1024 * 1024) throw new Error(`Evidence budget exceeded: ${bytes} bytes.`);
writeFileSync(
  resolve(job, 'SHA256SUMS.txt'),
  files
    .map(
      (file) =>
        `${createHash('sha256')
          .update(readFileSync(resolve(media, file)))
          .digest('hex')}  media/${file}`,
    )
    .join('\n') + '\n',
  'utf8',
);
console.log(`Hashed ${files.length} evidence files (${bytes} bytes).`);
