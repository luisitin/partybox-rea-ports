import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, '../..');
const scope = resolve(root, 'games/word-guess-race/server');
const definitions = JSON.parse(readFileSync(resolve(folder, 'mutations.json'), 'utf8'));
if (definitions.length !== 20) throw new Error('Exactly 20 mutation definitions are required');
const logFolder = resolve(folder, 'logs/mutations');
mkdirSync(logFolder, { recursive: true });

function test(file) {
  if (!/^games\/word-guess-race\/(server|__tests__)\/[^\s]+\.test\.ts$/.test(file))
    throw new Error(`Test outside this game: ${file}`);
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(command, ['vitest', 'run', file, '--maxWorkers=1'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
    shell: process.platform === 'win32',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  if (result.error || result.signal)
    throw new Error(`Test runner failed: ${result.error ?? result.signal}`);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const testFiles = [...new Set(definitions.map((d) => d.test))];
for (const file of testFiles) {
  const baseline = test(file);
  writeFileSync(resolve(logFolder, `baseline-${file.split('/').at(-1)}.txt`), baseline.output);
  if (baseline.status !== 0) throw new Error(`Mutation baseline is red: ${file}`);
}

const results = [];
for (const mutation of definitions) {
  const path = resolve(root, mutation.file);
  if (!path.startsWith(`${scope}${sep}`) || !path.endsWith('.ts'))
    throw new Error(`Mutation outside server scope: ${mutation.file}`);
  const original = readFileSync(path, 'utf8');
  const occurrences = original.split(mutation.before).length - 1;
  if (occurrences !== 1)
    throw new Error(
      `Mutation ${mutation.id}: expected one exact source anchor, found ${occurrences}`,
    );
  let result;
  try {
    writeFileSync(path, original.replace(mutation.before, mutation.after), 'utf8');
    result = test(mutation.test);
  } finally {
    writeFileSync(path, original, 'utf8');
  }
  const assertion = /AssertionError:|\bexpected .+ to\b/i.test(result.output);
  const brokenTool = /Transform failed|SyntaxError:|Failed to load url|No test files found/i.test(
    result.output,
  );
  const caught = result.status !== 0 && assertion && !brokenTool;
  const log = `logs/mutations/${mutation.id}.txt`;
  writeFileSync(resolve(folder, log), result.output, 'utf8');
  results.push({
    id: mutation.id,
    category: mutation.category,
    bug: mutation.bug,
    file: mutation.file,
    test: mutation.test,
    caught,
    assertion,
    firstFailure: result.output.match(/AssertionError:[^\r\n]*/)?.[0] ?? null,
    exit: result.status,
    log,
  });
  process.stdout.write(`${mutation.id}: ${caught ? 'CAUGHT' : 'SURVIVED'} — ${mutation.bug}\n`);
}
const caught = results.filter((r) => r.caught).length;
const report = {
  total: results.length,
  caught,
  required: 19,
  passed: caught >= 19,
  sourceRestored: true,
  method:
    'One exact source edit at a time; game-local assertions only; baseline green; finally restore',
  results,
};
writeFileSync(resolve(folder, 'mutation-results.json'), `${JSON.stringify(report, null, 2)}\n`);
const rows = results.map(
  (r) =>
    `| ${r.id} | ${r.category} | ${r.bug} | ${r.caught ? 'Caught' : 'Survived'} | [Log](${r.log}) |`,
);
writeFileSync(
  resolve(folder, 'mutation-results.md'),
  `# P10 mutation results\n\n${caught}/20 planted bugs caught (minimum 19). Sources restored after every run. A nonzero exit counts only when an assertion failed; transform/tool failures do not count.\n\n| ID | Category | Planted bug | Result | Evidence |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`,
  'utf8',
);
process.stdout.write(`${caught}/${results.length} caught; source restored\n`);
if (!report.passed) process.exitCode = 1;
