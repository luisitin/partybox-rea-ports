// Twenty serial semantic source bugs. Every original byte is restored in finally.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const folder = resolve('jobs/P23-bonk-io/tools');
const definitions = JSON.parse(readFileSync(resolve(folder, 'mutations.json'), 'utf8'));
if (definitions.length !== 20) throw new Error('Exactly twenty mutations are required');
const originals = new Map();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const bug of definitions) {
  if (!bug.file.startsWith('games/bonk-io/server/'))
    throw new Error('Mutation escaped this game server');
  if (!originals.has(bug.file)) originals.set(bug.file, readFileSync(resolve(bug.file)));
  const text = originals.get(bug.file).toString('utf8');
  if (text.split(bug.from).length !== 2) throw new Error(`Replacement is not unique: ${bug.name}`);
}
const active = resolve(folder, 'mutation-active.json');
const args = [
  'vitest',
  'run',
  'games/bonk-io/server',
  'games/bonk-io/client',
  'games/bonk-io/__tests__/game.test.ts',
  'games/bonk-io/__tests__/contract.test.ts',
  '--maxWorkers=1',
  '--reporter=json',
  `--outputFile=${active}`,
];
function check(label) {
  if (existsSync(active)) unlinkSync(active);
  const result =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/c', 'pnpm.cmd', ...args], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 120_000,
          maxBuffer: 8 * 1024 * 1024,
        })
      : spawnSync('pnpm', args, { encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  writeFileSync(resolve(folder, `${label}.log`), (result.stdout ?? '') + (result.stderr ?? ''));
  const report = existsSync(active) ? JSON.parse(readFileSync(active, 'utf8')) : null;
  const failures = (report?.testResults ?? []).flatMap((suite) =>
    (suite.assertionResults ?? [])
      .filter((test) => test.status === 'failed')
      .map((test) => ({ name: test.fullName, messages: test.failureMessages })),
  );
  const compileError = /Transform failed|SyntaxError|Failed to load|Cannot find module/.test(
    (result.stdout ?? '') + (result.stderr ?? ''),
  );
  return {
    exitCode: result.status,
    error: result.error?.message ?? null,
    tests: report?.numTotalTests ?? 0,
    passed: report?.numPassedTests ?? 0,
    failed: report?.numFailedTests ?? 0,
    failures,
    compileError,
  };
}
const cases = [];
let before, after;
try {
  before = check('mutation-baseline-before');
  if (before.exitCode !== 0 || before.failed || !before.tests)
    throw new Error('Clean baseline must pass');
  for (const [index, bug] of definitions.entries()) {
    const original = originals.get(bug.file);
    try {
      writeFileSync(resolve(bug.file), original.toString('utf8').replace(bug.from, bug.to), 'utf8');
      const checkResult = check(`mutation-${String(index + 1).padStart(2, '0')}`);
      const caught =
        checkResult.exitCode !== 0 &&
        checkResult.failed > 0 &&
        checkResult.failures.length > 0 &&
        !checkResult.compileError &&
        !checkResult.error;
      cases.push({ ...bug, caught, ...checkResult });
      console.log(`${index + 1}/20 ${caught ? 'CAUGHT' : 'MISSED'}: ${bug.name}`);
    } finally {
      writeFileSync(resolve(bug.file), original);
    }
  }
} finally {
  for (const [file, bytes] of originals) writeFileSync(resolve(file), bytes);
  after = check('mutation-baseline-after');
  const sources = [...originals].map(([file, bytes]) => ({
    file,
    beforeSha256: sha(bytes),
    afterSha256: sha(readFileSync(resolve(file))),
    restored: bytes.equals(readFileSync(resolve(file))),
  }));
  const report = {
    command: 'node jobs/P23-bonk-io/tools/mutate.mjs',
    scope: args,
    recordedAtUtc: new Date().toISOString(),
    baselineBefore: before,
    baselineAfter: after,
    attempted: cases.length,
    caught: cases.filter((c) => c.caught).length,
    sources,
    cases,
  };
  writeFileSync(resolve(folder, 'mutation-results.json'), JSON.stringify(report, null, 2) + '\n');
  if (existsSync(active)) unlinkSync(active);
  if (after.exitCode !== 0 || after.failed || sources.some((s) => !s.restored))
    throw new Error('Restored source baseline failed');
}
if (cases.length !== 20 || cases.filter((c) => c.caught).length < 19)
  throw new Error('Mutation threshold not met');
console.log(
  `${cases.filter((c) => c.caught).length}/20 caught; original bytes and baseline restored`,
);
