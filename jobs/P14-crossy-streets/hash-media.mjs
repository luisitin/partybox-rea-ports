import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const job = resolve('jobs/P14-crossy-streets');
const files = readdirSync(resolve(job, 'media')).sort();
let bytes = 0;
const lines = files.map((name) => {
  const path = resolve(job, 'media', name);
  if (!statSync(path).isFile()) throw new Error(`Unexpected media directory: ${name}`);
  const data = readFileSync(path);
  bytes += data.length;
  return `${createHash('sha256').update(data).digest('hex')}  media/${name}`;
});
if (bytes >= 10 * 1024 * 1024) throw new Error('Media exceeds the 10 MiB job limit.');
writeFileSync(resolve(job, 'SHA256SUMS.txt'), lines.join('\n') + '\n', 'utf8');
console.log(`${files.length} media files hashed; ${bytes} bytes total.`);
