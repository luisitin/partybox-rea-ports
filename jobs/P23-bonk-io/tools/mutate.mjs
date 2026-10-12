// Twenty serial semantic source bugs. Every original byte is restored in finally.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const folder = resolve('jobs/P23-bonk-io/tools');
const retryInfrastructure = process.argv.includes('--retry-infrastructure');
if (process.argv.slice(2).some((arg) => arg !== '--retry-infrastructure'))
  throw new Error('Unknown mutation option');
const previous = retryInfrastructure
  ? JSON.parse(readFileSync(resolve(folder, 'mutation-results.json'), 'utf8'))
  : null;
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
if (previous) {
  if (previous.cases.length !== 20) throw new Error('Previous run must contain twenty cases');
  for (const [file, bytes] of originals) {
    const prior = previous.sources.find((source) => source.file === file);
    if (!prior?.restored || prior.afterSha256 !== sha(bytes))
      throw new Error(`Retry source differs from restored first pass: ${file}`);
  }
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
          timeout: retryInfrastructure ? 240_000 : 120_000,
          maxBuffer: 8 * 1024 * 1024,
        })
      : spawnSync('pnpm', args, {
          encoding: 'utf8',
          timeout: retryInfrastructure ? 240_000 : 120_000,
          maxBuffer: 8 * 1024 * 1024,
        });
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
const cases = previous ? [...previous.cases] : [];
let before, after;
try {
  before = check('mutation-baseline-before');
  if (before.exitCode !== 0 || before.failed || !before.tests)
    throw new Error('Clean baseline must pass');
  for (const [index, bug] of definitions.entries()) {
    const prior = previous?.cases[index];
    if (prior?.caught) continue;
    if (
      prior &&
      (prior.name !== bug.name || !prior.error || prior.tests !== 0 || prior.failures.length !== 0)
    )
      throw new Error('Only an infrastructure failure with zero test results may be retried');
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
      const result = { ...bug, caught, ...checkResult, ...(prior ? { firstAttempt: prior } : {}) };
      if (previous) cases[index] = result;
      else cases.push(result);
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
    command: `node jobs/P23-bonk-io/tools/mutate.mjs${retryInfrastructure ? ' --retry-infrastructure' : ''}`,
    scope: args,
    recordedAtUtc: new Date().toISOString(),
    baselineBefore: before,
    baselineAfter: after,
    attempted: cases.length,
    caught: cases.filter((c) => c.caught).length,
    sources,
    cases,
    ...(previous
      ? {
          firstPass: {
            recordedAtUtc: previous.recordedAtUtc,
            caught: previous.caught,
            attempted: previous.attempted,
          },
        }
      : {}),
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
