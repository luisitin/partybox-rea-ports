// Include every media file (HTML, PNG, JSON and any nested evidence) in the same budget/hash.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export function hashMedia(job = import.meta.dirname) {
  if (process.env.WRITE_P02_EVIDENCE !== '1')
    throw new Error('Set WRITE_P02_EVIDENCE=1 to write P02 evidence hashes.');
  const media = resolve(job, 'media');
  const files = [];
  function collect(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (!path.startsWith(`${media}${sep}`))
        throw new Error('Media path escaped its job directory.');
      if (entry.isSymbolicLink()) throw new Error(`Evidence must be self-contained: ${entry.name}`);
      if (entry.isDirectory()) collect(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`Unsupported media entry: ${entry.name}`);
    }
  }
  collect(media);
  files.sort();
  const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  const limitBytes = 10 * 1024 * 1024;
  if (bytes >= limitBytes)
    throw new Error(`Evidence budget exceeded: ${bytes} bytes (limit ${limitBytes}).`);
  const lines = files.map(
    (file) =>
      `${createHash('sha256').update(readFileSync(file)).digest('hex')}  media/${relative(media, file).split(sep).join('/')}`,
  );
  writeFileSync(resolve(job, 'SHA256SUMS.txt'), lines.join('\n') + '\n', 'utf8');
  return { files: files.length, bytes, limitBytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.WRITE_P02_EVIDENCE !== '1')
    console.log('P02 hashing disabled; set WRITE_P02_EVIDENCE=1 to write evidence hashes.');
  else console.log(JSON.stringify(hashMedia(), null, 2));
}
