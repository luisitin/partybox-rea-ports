// Serial, reversible mutation audit. Tooling is deliberately outside the pure game.
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const jobDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(jobDir, '../..');
const gameDir = 'games/hole-io';
const server = `${gameDir}/server/`;
const require = createRequire(import.meta.url);
let vitestDir;
try {
  vitestDir = dirname(require.resolve('vitest/package.json'));
} catch {
  vitestDir = resolve(dirname(require.resolve('vitest')), '..');
}
const vitestCli = join(vitestDir, 'vitest.mjs');
if (!existsSync(vitestCli)) throw new Error(`Installed Vitest CLI not found: ${vitestCli}`);
const mutations = [
  {
    "id": "M01",
    "name": "Double banked intake",
    "file": "world.ts",
    "from": "hole.score += points;",
    "to": "hole.score += points * 2;"
  },
  {
    "id": "M02",
    "name": "Lose growth from food",
    "file": "world.ts",
    "from": "hole.mass += points;",
    "to": "hole.mass += 0;"
  },
  {
    "id": "M03",
    "name": "Omit eliminated players from banked result scores",
    "file": "scoring.ts",
    "from": "world.holes.map((h) => [h.id, h.score])",
    "to": "world.holes.filter((h) => h.alive !== false).map((h) => [h.id, h.score])"
  },
  {
    "id": "M04",
    "name": "Swallow food too large for the rim",
    "file": "world.ts",
    "from": "p.availableAt > at || p.radius >= radius",
    "to": "p.availableAt > at"
  },
  {
    "id": "M05",
    "name": "Consume food without footprint overlap",
    "file": "world.ts",
    "from": "distance > (radius - p.radius * 0.5) ** 2",
    "to": "distance > (radius + p.radius * 0.5) ** 2"
  },
  {
    "id": "M06",
    "name": "Move faster diagonally",
    "file": "world.ts",
    "from": "const norm = Math.max(1, Math.hypot(input.x, input.y));",
    "to": "const norm = 1;"
  },
  {
    "id": "M07",
    "name": "Accept stale movement before both settled time and the last input",
    "file": "phases/play.ts",
    "from": "event.now < state.began + state.world.elapsed ||\n    event.now - state.began <\n      (state.world.holes.find((hole) => hole.id === event.playerId)?.lastMoveAt ?? -1)",
    "to": "false"
  },
  {
    "id": "M08",
    "name": "Accept a stale engine timer stamp",
    "file": "phases/play.ts",
    "from": "!isTimerFor(state, event) || event.now < (state.phase.deadline ?? Infinity)",
    "to": "event.now < (state.phase.deadline ?? Infinity)"
  },
  {
    "id": "M09",
    "name": "Keep the pre-pause end after resume",
    "file": "index.ts",
    "from": "endsAt: s.endsAt + ms",
    "to": "endsAt: s.endsAt"
  },
  {
    "id": "M10",
    "name": "Miss the exact ninety-second exit",
    "file": "phases/play.ts",
    "from": "return now >= s.endsAt ? next(s, now) : nextStep(s, Math.min(s.endsAt, now + TICK_MS));",
    "to": "return now > s.endsAt ? next(s, now) : nextStep(s, Math.min(s.endsAt, now + TICK_MS));"
  },
  {
    "id": "M11",
    "name": "Expose private RNG on the public TV",
    "file": "index.ts",
    "from": "city: cityView(s),\n    elapsed: s.world.elapsed,",
    "to": "city: cityView(s),\n    elapsed: s.world.elapsed, rng: s.rng,"
  },
  {
    "id": "M12",
    "name": "Give easy bots sharp selective hunting",
    "file": "bot.ts",
    "from": "if (skill === 'sharp' && !threats.length)",
    "to": "if (skill === 'easy' && !threats.length)"
  },
  {
    "id": "M13",
    "name": "Remove initial protection",
    "file": "world.ts",
    "from": "immuneUntil: IMMUNE_MS,",
    "to": "immuneUntil: 0,"
  },
  {
    "id": "M14",
    "name": "Erase banked points when swallowed",
    "file": "world.ts",
    "from": "small.alive = false;",
    "to": "small.alive = false; small.score = 0;"
  },
  {
    "id": "M15",
    "name": "Let equal-sized holes swallow each other",
    "file": "world.ts",
    "from": "br < sr * 1.25",
    "to": "br < sr"
  },
  {
    "id": "M16",
    "name": "Ignore the victim shield",
    "file": "world.ts",
    "from": "small === big || !isAlive(small) || small.immuneUntil > at",
    "to": "small === big || !isAlive(small)"
  },
  {
    "id": "M17",
    "name": "Re-enable swallowed victims after recording loss",
    "file": "world.ts",
    "from": "small.eliminatedAt = at;",
    "to": "small.eliminatedAt = at; small.alive = true;"
  },
  {
    "id": "M18",
    "name": "Slow higher tiers twice as quickly",
    "file": "world.ts",
    "from": "19 - (levelOf(mass) - 1) * 0.7",
    "to": "19 - (levelOf(mass) - 1) * 1.4"
  },
  {
    "id": "M19",
    "name": "Award contested food to the farther hole",
    "file": "world.ts",
    "from": "distance < prev.distance",
    "to": "distance > prev.distance"
  },
  {
    "id": "M20",
    "name": "Remove small-food recycling",
    "file": "world.ts",
    "from": "p.radius <= 2.6 ? at + RECYCLE_MS : ROUND_MS + 1",
    "to": "p.radius < 0 ? at + RECYCLE_MS : ROUND_MS + 1"
  },
  {
    "id": "M21",
    "name": "Always favor the first tied surviving contender",
    "file": "world.ts",
    "from": "contenders[(p.id + at / STEP_MS) % contenders.length]!",
    "to": "contenders[0]!"
  },
  {
    "id": "M22",
    "name": "Remove the public sink receipt bound",
    "file": "world.ts",
    "from": "world.sinks = world.sinks.slice(-MAX_SINKS);",
    "to": "world.sinks = world.sinks;"
  },
  {
    "id": "M23",
    "name": "Omit local-phone city beside a TV",
    "file": "index.ts",
    "from": "    city,\n    elapsed: s.world.elapsed,",
    "to": "    city: s.phoneOnly ? city : undefined,\n    elapsed: s.world.elapsed,"
  },
  {
    "id": "M24",
    "name": "Keep a permanently departed hole alive in physics",
    "file": "index.ts",
    "from": "...(connected.left?.includes(e.playerId) ? { alive: false } : {}),",
    "to": "...(false ? { alive: false } : {}),"
  },
  {
    "id": "M25",
    "name": "Delay growth at exact tier thresholds",
    "file": "world.ts",
    "from": "if (mass >= GROWTH_THRESHOLDS[i]!) level = i + 1;",
    "to": "if (mass > GROWTH_THRESHOLDS[i]!) level = i + 1;"
  }
];

const focusedFiles = ['world.test.ts', 'game.test.ts', 'views-bots.test.ts', 'loss-growth.test.ts'];
const args = [
  'run', ...focusedFiles.map((file) => gameDir + '/__tests__/' + file),
  '--maxWorkers=1', '--pool=threads', '--no-file-parallelism',
];

const command = `node ${relative(root, vitestCli).replaceAll('\\', '/')} ${args.join(' ')}`;
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');
const originals = new Map();

// Reject missing or ambiguous anchors before any source is changed or tests run.
for (const mutation of mutations) {
  const file = resolve(root, `${server}${mutation.file}`);
  if (!originals.has(file)) originals.set(file, readFileSync(file));
  const source = originals.get(file).toString('utf8').replaceAll('\r\n', '\n');
  const matches = source.split(mutation.from).length - 1;
  if (matches !== 1) {
    throw new Error(
      `${mutation.id}: expected exactly one anchor in ${mutation.file}, found ${matches}`,
    );
  }
}
if (new Set(mutations.map((m) => `${m.file}:${m.from}`)).size !== mutations.length) {
  throw new Error('Mutation anchors must be distinct.');
}
if (process.argv.includes('--list')) {
  console.table(mutations.map(({ id, name, file }) => ({ id, mutation: name, file })));
  console.log(`${mutations.length} anchors match exactly once. No sources changed and no tests run.`);
  process.exit(0);
}
if (process.argv.length !== 2)
  throw new Error('Usage: node jobs/P08-hole-swallow/mutate.mjs [--list]');

const lock = join(jobDir, '.mutation.lock');
writeFileSync(lock, `${process.pid}\n`, { flag: 'wx', encoding: 'utf8' });
const reportDir = mkdtempSync(join(tmpdir(), 'hole-swallow-mutations-'));
const audit = {
  generatedAt: new Date().toISOString(),
  command,
  baseline: null,
  sourceSha256: Object.fromEntries(
    [...originals].map(([file, buffer]) => [
      relative(root, file).replaceAll('\\', '/'),
      digest(buffer),
    ]),
  ),
  mutationCount: mutations.length,
  focusedFiles,
  workerConfiguration: { pool: 'threads', maxWorkers: 1, fileParallelism: false },
  requiredCaught: Math.ceil(mutations.length * 0.95),
  caught: 0,
  survived: 0,
  invalid: 0,
  mutations: [],
};

async function runTests(label) {
  const reportFile = join(reportDir, label + '.json');
  const runArgs = [...args, '--reporter=json', '--outputFile=' + reportFile];
  const started = Date.now();
  const child = spawn(process.execPath, [vitestCli, ...runArgs], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
  });
  let output = '';
  let spawnError = null;
  let timedOut = false;
  const samples = [];
  let sampling = false;
  let pendingSample = Promise.resolve();
  const sample = () => {
    if (process.platform !== 'win32' || sampling || !child.pid || samples.length >= 32) return;
    sampling = true;
    const nativeCommand =
      'try { $p = Get-Process -Id ' + child.pid +
      ' -ErrorAction Stop; [pscustomobject]@{ pid=$p.Id; threads=$p.Threads.Count; cpuSeconds=$p.CPU; workingSetBytes=$p.WorkingSet64 } | ConvertTo-Json -Compress } catch { "{}" }';
    pendingSample = new Promise((done) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', nativeCommand],
        { windowsHide: true, timeout: 10_000, maxBuffer: 16_384 }, (error, stdout) => {
          try {
            const value = !error && stdout.trim() ? JSON.parse(stdout) : null;
            if (value?.pid === child.pid && Number.isFinite(value.threads))
              samples.push({ atMs: Date.now() - started, ...value });
          } catch { /* A vanished process is not a native sample. */ }
          sampling = false;
          done();
        });
    });
  };
  sample();
  const sampler = setInterval(sample, 4000);
  const watchdog = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, 120_000);
  const append = (chunk) => {
    output = (output + chunk.toString('utf8')).slice(-5 * 1024 * 1024);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  const result = await new Promise((done) => {
    child.once('error', (error) => { spawnError = error; });
    child.once('close', (status, signal) => done({ status, signal }));
  });
  clearTimeout(watchdog);
  clearInterval(sampler);
  await pendingSample;
  let report = null;
  let reportError = null;
  if (existsSync(reportFile)) {
    try { report = JSON.parse(readFileSync(reportFile, 'utf8')); }
    catch (error) { reportError = error.message; }
  }
  const failedTests = (report?.testResults || []).flatMap((suite) =>
    (suite.assertionResults || [])
      .filter((assertion) => assertion.status === 'failed')
      .map((assertion) => assertion.fullName || assertion.title));
  const failedLoads = (report?.testResults || []).filter(
    (suite) => suite.status === 'failed' && !(suite.assertionResults || []).length);
  const loadError = failedLoads.length > 0 ||
    /SyntaxError|Transform failed|Failed to resolve import|Cannot find module|No test files found|Error while loading/i.test(output);
  const testCountChanged = label !== 'baseline' &&
    report?.numTotalTests !== audit.baseline?.totalTests;
  const invalid = Boolean(spawnError || timedOut || result.signal || !report ||
    reportError || loadError || testCountChanged || report.numTotalTests === 0);
  // Only a loaded assertion failure can kill a mutant. Timeout/import failures are INVALID.
  const killed = result.status !== 0 && failedTests.length > 0 && !invalid;
  const peakNativeThreads = samples.length ? Math.max(...samples.map((s) => s.threads)) : null;
  return {
    pid: child.pid ?? null,
    elapsedMs: Date.now() - started,
    exitCode: result.status,
    signal: result.signal,
    error: spawnError?.message || reportError || null,
    timedOut,
    totalTests: report?.numTotalTests ?? 0,
    failedTests,
    failedLoads: failedLoads.map((suite) => suite.name),
    testCountChanged,
    invalid,
    killed,
    threadSampler: { intervalMs: 4000, maxSamples: 32, peakNativeThreads, samples },
    outputTail: invalid ? output.slice(-2200) : undefined,
  };
}

try {
  console.log('Serial mutation audit: keep server sources unchanged until this command exits.');
  const baseline = await runTests('baseline');
  audit.baseline = baseline;
  if (baseline.invalid || baseline.exitCode !== 0 || baseline.totalTests === 0) {
    throw new Error('Unmutated mechanics baseline must load successfully and pass.');
  }
  for (const mutation of mutations) {
    const file = resolve(root, `${server}${mutation.file}`);
    const original = originals.get(file);
    if (!readFileSync(file).equals(original)) {
      throw new Error(`${mutation.id}: source changed since preflight; refusing to overwrite it.`);
    }
    const source = original.toString('utf8').replaceAll('\r\n', '\n');
    let outcome;
    try {
      writeFileSync(file, source.replace(mutation.from, mutation.to), 'utf8');
      outcome = await runTests(mutation.id);
    } finally {
      writeFileSync(file, original);
    }
    if (!readFileSync(file).equals(original))
      throw new Error(`${mutation.id}: restore verification failed.`);
    const status = outcome.invalid ? 'INVALID' : outcome.killed ? 'KILLED' : 'SURVIVED';
    audit.mutations.push({
      ...mutation,
      file: `${server}${mutation.file}`,
      status,
      restored: true,
      ...outcome,
    });
    console.log(`${mutation.id} ${status}: ${mutation.name}`);
    if (outcome.invalid) audit.invalid++;
    else if (outcome.killed) audit.caught++;
    else audit.survived++;
    writeFileSync(join(jobDir, 'mutations.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  }
} catch (error) {
  audit.error = error.message;
  process.exitCode = 1;
} finally {
  audit.finishedAt = new Date().toISOString();
  audit.complete = audit.mutations.length === mutations.length;
  audit.sourceRestoredSha256 = Object.fromEntries(
    [...originals].map(([file, buffer]) => [relative(root, file).replaceAll('\\', '/'), digest(readFileSync(file))]),
  );
  audit.restorationVerified = [...originals].every(([file, buffer]) => readFileSync(file).equals(buffer));
  audit.peakNativeThreads = Math.max(0, ...[audit.baseline, ...audit.mutations]
    .flatMap((run) => run?.threadSampler?.samples ?? []).map((sample) => sample.threads));
  audit.passed = audit.complete && audit.caught >= audit.requiredCaught &&
    audit.invalid === 0 && audit.restorationVerified;
  writeFileSync(join(jobDir, 'mutations.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.table(
    audit.mutations.map(({ id, name, status, failedTests }) => ({
      id,
      mutation: name,
      status,
      failedAssertions: failedTests.length,
    })),
  );
  console.log(
    `Caught ${audit.caught}/${mutations.length}; survived ${audit.survived}; invalid ${audit.invalid}; required >=${audit.requiredCaught}.`,
  );
  if (audit.error) console.error(audit.error);
  if (!audit.passed) process.exitCode = 1;
  for (const label of ['baseline', ...mutations.map((m) => m.id)]) {
    const report = join(reportDir, `${label}.json`);
    if (existsSync(report)) unlinkSync(report);
  }
  rmdirSync(reportDir);
  unlinkSync(lock);
}
