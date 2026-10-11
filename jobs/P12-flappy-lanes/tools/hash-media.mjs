import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const folder = resolve('jobs/P12-flappy-lanes');
const media = join(folder, 'media');
const files = readdirSync(media).sort();
const lines = files.map((file) => {
  const hash = createHash('sha256')
    .update(readFileSync(join(media, file)))
    .digest('hex');
  return `${hash}  media/${file}`;
});
writeFileSync(join(folder, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'utf8');
console.log(`Hashed ${files.length} media files`);
process.exit(0);
