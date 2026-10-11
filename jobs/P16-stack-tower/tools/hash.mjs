// Hash the exact committed evidence bytes, after capture and formatting.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';

const dir = new URL('../media/', import.meta.url);
const names = readdirSync(dir).sort();
const total = names.reduce((sum, name) => sum + statSync(new URL(name, dir)).size, 0);
if (total >= 10_000_000) throw new Error(`Media budget exceeded: ${total}`);
writeFileSync(
  new URL('../SHA256SUMS.txt', import.meta.url),
  names
    .map(
      (name) =>
        `${createHash('sha256')
          .update(readFileSync(new URL(name, dir)))
          .digest('hex')}  media/${name}`,
    )
    .join('\n') + '\n',
);
console.log(`${names.length} evidence files; ${total} bytes; hashes written.`);
