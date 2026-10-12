import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const media = resolve(import.meta.dirname, 'media');
const files = readdirSync(media).sort();
const bytes = files.reduce((total, file) => total + statSync(resolve(media, file)).size, 0);
if (bytes >= 10 * 1024 * 1024) throw new Error(`Media budget exceeded: ${bytes}`);
writeFileSync(
  resolve(import.meta.dirname, 'SHA256SUMS.txt'),
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
console.log(JSON.stringify({ files: files.length, bytes }));
