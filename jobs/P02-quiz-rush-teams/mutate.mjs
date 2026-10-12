// Bounded sequential rule mutations; never reset Git or discard the launch-time working tree.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mutants } from './mutation-cases.mjs';

const job = dirname(fileURLToPath(import.meta.url));
const root = resolve(job, '../..');
const prefix = 'games/kahoot/server/';
// Full 1,000-seed property traces run separately; rule mutations need the focused behavioral checks.
const tests = ['game.test.ts', 'teams.test.ts'].map((name) => `games/kahoot/__tests__/${name}`);
const timeoutMs = 30_000;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (path) => path.replaceAll('\\', '/');
const lock = join(job, 'mutation.lock');
writeFileSync(lock, `${process.pid}\n`, { flag: 'wx' });
const work = mkdtempSync(join(job, '.mutation-work-'));
const reportPath = join(work, 'vitest.json');
const logs = join(job, 'mutation-logs');
mkdirSync(logs, { recursive: true });
const args = [
  'vitest',
  'run',
  ...tests,
  '--pool=threads',
  '--maxWorkers=1',
  '--no-file-parallelism',
  '--reporter=json',
  `--outputFile=${slash(relative(root, reportPath))}`,
];
// Windows receives only these fixed/validated tokens: no interpolated shell paths or user text.
if (args.some((arg) => !/^[A-Za-z0-9_./=-]+$/.test(arg))) throw new Error('Unsafe command token');
const testCommand = `pnpm ${args.join(' ')}`;
const originals = new Map();
for (const { file } of mutants) {
  const path = resolve(root, prefix + file);
  if (!originals.has(path)) originals.set(path, readFileSync(path));
}
const backups = [...originals].map(([path, bytes], index) => {
  const backup = join(work, `source-${index}.bak`);
  writeFileSync(backup, bytes);
  return backup;
});
let active = null;
let abortReason = '';
let unsafeChildren = false;

function stopChild() {
  if (!active || active.closed || active.child.exitCode !== null) return;
  const pid = active.child.pid;
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    if (process.platform === 'win32') {
      const stopped = spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        encoding: 'utf8',
        timeout: 5000,
      });
      if (stopped.error || (stopped.status !== 0 && active.child.exitCode === null)) {
        unsafeChildren = true;
        active.killError = stopped.error?.message ?? stopped.stderr ?? 'taskkill failed';
      }
    } else process.kill(-pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') {
      unsafeChildren = true;
      active.killError = String(error);
    }
  }
}
const interrupt = (signal) => {
  abortReason = `Interrupted by ${signal}`;
  stopChild();
};
const onInterrupt = () => interrupt('SIGINT');
const onTerminate = () => interrupt('SIGTERM');
process.on('SIGINT', onInterrupt);
process.on('SIGTERM', onTerminate);

async function runRules(label) {
  if (unsafeChildren)
    throw new Error('Cannot start another child after an unverified tree shutdown');
  if (existsSync(reportPath)) unlinkSync(reportPath);
  const started = Date.now();
  const output = await new Promise((resolveRun) => {
    const windows = process.platform === 'win32';
    const child = spawn(
      windows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm',
      windows ? ['/d', '/s', '/c', testCommand] : args,
      {
        cwd: root,
        shell: false,
        windowsHide: true,
        detached: !windows,
        env: { ...process.env, NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const current = { child, closed: false, killError: '' };
    active = current;
    let stdout = '';
    let stderr = '';
    let spawnError = '';
    let timedout = false;
    child.stdout.on('data', (bytes) => {
      stdout = (stdout + bytes.toString('utf8')).slice(-262_144);
    });
    child.stderr.on('data', (bytes) => {
      stderr = (stderr + bytes.toString('utf8')).slice(-262_144);
    });
    child.on('error', (error) => {
      spawnError = error.message;
    });
    const timer = setTimeout(() => {
      timedout = true;
      stopChild();
    }, timeoutMs);
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      current.closed = true;
      if (active === current) active = null;
      resolveRun({
        exitCode,
        signal,
        stdout,
        stderr,
        spawnError,
        timedout,
        killError: current.killError,
      });
    });
  });
  const logFile = `mutation-logs/${label}.log`;
  writeFileSync(
    join(job, logFile),
    `${testCommand}\nexit=${output.exitCode} signal=${output.signal ?? ''} timeout=${output.timedout}\n${output.stdout}\n${output.stderr}\n${output.spawnError}\n${output.killError}`,
    'utf8',
  );
  let report = null;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    /* Classified below. */
  }
  if (existsSync(reportPath)) unlinkSync(reportPath);
  const suites = report?.testResults ?? [];
  const assertions = suites.flatMap((suite) => suite.assertionResults ?? []);
  const failed = assertions
    .filter((test) => test.status === 'failed')
    .map((test) => ({
      name: test.fullName,
      messages: (test.failureMessages ?? []).map((message) => message.slice(0, 1600)),
    }));
  const failedLoads = suites.filter(
    (suite) => suite.status === 'failed' && !(suite.assertionResults?.length > 0),
  );
  const timedOutTests = failed.some((test) =>
    test.messages.some((message) => /Test timed out/i.test(message)),
  );
  const toolFailure =
    /Unhandled Errors?|Unhandled Rejection|Unhandled Exception|Transform failed|SyntaxError|Parse failure|Failed to resolve import|ERR_MODULE_NOT_FOUND|Cannot find module/i.test(
      output.stderr,
    );
  const invalidReason =
    output.spawnError ||
    output.killError ||
    (output.timedout ? 'Child exceeded 30 seconds' : '') ||
    (!report ? 'No readable Vitest JSON report' : '') ||
    (!assertions.length ? 'No executed test assertions' : '') ||
    (toolFailure ? 'Compiler/module/unhandled tool failure in stderr' : '') ||
    (failedLoads.length ? 'Test suite load/transform failed' : '') ||
    (timedOutTests ? 'Test timed out' : '') ||
    (report?.numRuntimeErrorTestSuites > 0 ? 'Vitest reported a runtime/tool error' : '') ||
    (output.signal ? `Child terminated by ${output.signal}` : '') ||
    ((output.exitCode === 0) !== (failed.length === 0)
      ? 'Exit status disagrees with test assertions'
      : '');
  return {
    exitCode: output.exitCode,
    signal: output.signal,
    timedout: output.timedout,
    durationMs: Date.now() - started,
    tests: assertions.length,
    failed,
    invalidReason,
    logFile,
  };
}

function mutationSource(source, anchor, replacement, id) {
  // Formatting is irrelevant; positions still refer to the exact launch-time source string.
  const positions = [];
  let compact = '';
  for (let index = 0; index < source.length; index++) {
    if (/\s/.test(source[index])) continue;
    compact += source[index];
    positions.push(index);
  }
  const needle = anchor.replace(/\s/g, '');
  const occurrences = [];
  for (
    let offset = compact.indexOf(needle);
    offset !== -1;
    offset = compact.indexOf(needle, offset + 1)
  )
    occurrences.push(offset);
  if (occurrences.length !== 1)
    throw new Error(`${id}: expected one unique anchor, found ${occurrences.length}`);
  const start = positions[occurrences[0]];
  const end = positions[occurrences[0] + needle.length - 1] + 1;
  return source.slice(0, start) + replacement + source.slice(end);
}

const evidence = {
  command: 'node jobs/P02-quiz-rush-teams/mutate.mjs',
  testCommand,
  timeoutMs,
  sourceHashes: Object.fromEntries(
    [...originals].map(([path, bytes]) => [slash(relative(root, path)), hash(bytes)]),
  ),
  baseline: null,
  postBaseline: null,
  results: [],
  restorationVerified: false,
  error: '',
};
try {
  evidence.baseline = await runRules('baseline');
  if (evidence.baseline.invalidReason || evidence.baseline.exitCode !== 0)
    throw new Error('Unmutated baseline is not green');
  // Preflight every anchor before the first edit; dirty working-tree bytes are the intentional baseline.
  for (const mutant of mutants)
    mutationSource(
      originals.get(resolve(root, prefix + mutant.file)).toString('utf8'),
      mutant.anchor,
      mutant.replacement,
      mutant.id,
    );
  console.log(`Baseline: ${evidence.baseline.tests} checks passed`);
  for (const mutant of mutants) {
    if (abortReason) throw new Error(abortReason);
    const path = resolve(root, prefix + mutant.file);
    const original = originals.get(path);
    if (hash(readFileSync(path)) !== hash(original))
      throw new Error(`Source changed during campaign: ${mutant.file}`);
    let outcome;
    try {
      writeFileSync(
        path,
        mutationSource(original.toString('utf8'), mutant.anchor, mutant.replacement, mutant.id),
        'utf8',
      );
      outcome = await runRules(mutant.id);
    } finally {
      writeFileSync(path, original);
      if (hash(readFileSync(path)) !== hash(original))
        throw new Error(`Failed exact restore: ${mutant.file}`);
    }
    const status = outcome.invalidReason
      ? 'invalid'
      : outcome.exitCode !== 0 && outcome.failed.length > 0
        ? 'killed'
        : 'survived';
    evidence.results.push({
      id: mutant.id,
      description: mutant.description,
      file: prefix + mutant.file,
      expected: mutant.expected,
      status,
      ...outcome,
    });
    console.log(`${mutant.id}: ${status} (${outcome.failed.length} failed tests)`);
    if (status === 'invalid') throw new Error(`${mutant.id}: ${outcome.invalidReason}`);
  }
} catch (error) {
  evidence.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  // Per-mutant and outer finally both restore Buffer bytes, including original BOM/newline style.
  for (const [path, bytes] of originals) writeFileSync(path, bytes);
  evidence.restoredHashes = Object.fromEntries(
    [...originals].map(([path]) => [slash(relative(root, path)), hash(readFileSync(path))]),
  );
  evidence.restorationVerified = [...originals].every(
    ([path, bytes]) => hash(readFileSync(path)) === hash(bytes),
  );
  try {
    if (abortReason || unsafeChildren)
      throw new Error(abortReason || 'Child tree shutdown unverified');
    evidence.postBaseline = await runRules('post-baseline');
    if (evidence.postBaseline.invalidReason || evidence.postBaseline.exitCode !== 0)
      throw new Error('Restored post-baseline is not green');
  } catch (error) {
    evidence.error += `\nPost-baseline: ${error.stack ?? String(error)}`;
    process.exitCode = 1;
  }
  evidence.mutations = mutants.length;
  evidence.killed = evidence.results.filter((result) => result.status === 'killed').length;
  evidence.invalidMutations = evidence.results.filter(
    (result) => result.status === 'invalid',
  ).length;
  evidence.complete =
    !evidence.error && evidence.restorationVerified && evidence.results.length === mutants.length;
  writeFileSync(
    join(job, 'mutation-results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
    'utf8',
  );
  process.removeListener('SIGINT', onInterrupt);
  process.removeListener('SIGTERM', onTerminate);
  if (evidence.restorationVerified) {
    for (const backup of backups) unlinkSync(backup);
    if (existsSync(reportPath)) unlinkSync(reportPath);
    rmdirSync(work);
  }
  unlinkSync(lock);
  console.log(
    `${evidence.killed}/${mutants.length} meaningful mutations detected; source restored=${evidence.restorationVerified}`,
  );
  if (!evidence.complete || evidence.invalidMutations > 0 || evidence.killed < 19)
    process.exitCode = 1;
}
