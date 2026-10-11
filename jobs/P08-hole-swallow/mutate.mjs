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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const jobDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(jobDir, '../..');
const gameDir = 'games/hole-swallow';
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
    id: 'M01',
    name: 'Double the intake score',
    file: 'world.ts',
    from: 'hole.score += points;',
    to: 'hole.score += points * 2;',
  },
  {
    id: 'M02',
    name: 'Lose growth from swallowed props',
    file: 'world.ts',
    from: 'hole.mass += points;',
    to: 'hole.mass += 0;',
  },
  {
    id: 'M03',
    name: 'Award final growth instead of retained intake',
    file: 'scoring.ts',
    from: 'world.holes.map((h) => [h.id, h.score])',
    to: 'world.holes.map((h) => [h.id, h.mass])',
  },
  {
    id: 'M04',
    name: 'Allow an equal-width object to fit',
    file: 'world.ts',
    from: 'p.availableAt > at || p.radius >= radius',
    to: 'p.availableAt > at || p.radius > radius',
  },
  {
    id: 'M05',
    name: 'Consume an object without footprint overlap',
    file: 'world.ts',
    from: 'distance > (radius - p.radius * 0.5) ** 2',
    to: 'distance > (radius + p.radius * 0.5) ** 2',
  },
  {
    id: 'M06',
    name: 'Let diagonal steering move faster',
    file: 'world.ts',
    from: 'const norm = Math.max(1, Math.hypot(input.x, input.y));',
    to: 'const norm = 1;',
  },
  {
    id: 'M07',
    name: 'Accept an input from before the settled world',
    file: 'phases/play.ts',
    from: 'event.now < state.began + state.world.elapsed',
    to: 'false',
  },
  {
    id: 'M08',
    name: 'Accept a stale timer phase stamp',
    file: 'phases/play.ts',
    from: '!isTimerFor(state, event) || event.now < (state.phase.deadline ?? Infinity)',
    to: 'event.now < (state.phase.deadline ?? Infinity)',
  },
  {
    id: 'M09',
    name: 'Keep the old round end after resuming a pause',
    file: 'index.ts',
    from: 'endsAt: s.endsAt + ms',
    to: 'endsAt: s.endsAt',
  },
  {
    id: 'M10',
    name: 'Miss the phase exit at exactly ninety seconds',
    file: 'phases/play.ts',
    from: 'return now >= s.endsAt ? next(s, now) : nextStep(s, Math.min(s.endsAt, now + TICK_MS));',
    to: 'return now > s.endsAt ? next(s, now) : nextStep(s, Math.min(s.endsAt, now + TICK_MS));',
  },
  {
    id: 'M11',
    name: 'Leak private RNG state through the stage view',
    file: 'index.ts',
    from: 'elapsed: s.world.elapsed,',
    to: 'elapsed: s.world.elapsed, rng: s.rng,',
  },
  {
    id: 'M12',
    name: 'Remove sharp bots selective hunting strategy',
    file: 'bot.ts',
    from: "if (skill === 'sharp' && !threats.length)",
    to: "if (skill === 'easy' && !threats.length)",
  },
  {
    id: 'M13',
    name: 'Drop protection when a victim respawns',
    file: 'world.ts',
    from: 'h.immuneUntil = at + IMMUNE_MS;',
    to: 'h.immuneUntil = at;',
  },
  {
    id: 'M14',
    name: 'Erase accumulated score when swallowed',
    file: 'world.ts',
    from: 'small.mass = 0;',
    to: 'small.mass = 0; small.score = 0;',
  },
  {
    id: 'M15',
    name: 'Allow equal holes to swallow one another',
    file: 'world.ts',
    from: 'br < sr * 1.25',
    to: 'br < sr',
  },
  {
    id: 'M16',
    name: 'Bypass the victims active shield',
    file: 'world.ts',
    from: 'small === big || small.respawnAt !== null || small.immuneUntil > at',
    to: 'small === big || small.respawnAt !== null',
  },
  {
    id: 'M17',
    name: 'Double the forced respawn wait',
    file: 'world.ts',
    from: 'small.respawnAt = at + RESPAWN_MS;',
    to: 'small.respawnAt = at + RESPAWN_MS * 2;',
  },
  {
    id: 'M18',
    name: 'Slow growing holes twice as quickly',
    file: 'world.ts',
    from: '19 - Math.sqrt(mass) * 0.35',
    to: '19 - Math.sqrt(mass) * 0.7',
  },
  {
    id: 'M19',
    name: 'Give a contested prop to the farther hole',
    file: 'world.ts',
    from: 'distance < prev.distance',
    to: 'distance > prev.distance',
  },
  {
    id: 'M20',
    name: 'Remove small-object recycling',
    file: 'world.ts',
    from: 'p.radius <= 2.6 ? at + RECYCLE_MS : ROUND_MS + 1',
    to: 'p.radius < 0 ? at + RECYCLE_MS : ROUND_MS + 1',
  },
];

const args = [
  'run',
  gameDir,
  '--maxWorkers=1',
  '--pool=threads',
  '--exclude',
  `${gameDir}/__tests__/contract.test.ts`,
  '--exclude',
  `${gameDir}/__tests__/properties.test.ts`,
  '--exclude',
  `${gameDir}/__tests__/screens.test.tsx`,
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
if (new Set(mutations.map((m) => `${m.file}:${m.from}`)).size !== 20) {
  throw new Error('Mutation anchors must be distinct.');
}
if (process.argv.includes('--list')) {
  console.table(mutations.map(({ id, name, file }) => ({ id, mutation: name, file })));
  console.log('All 20 anchors match exactly once. No sources changed and no tests run.');
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
  requiredCaught: 19,
  caught: 0,
  survived: 0,
  invalid: 0,
  mutations: [],
};

function runTests(label) {
  const reportFile = join(reportDir, `${label}.json`);
  const runArgs = [...args, '--reporter=json', `--outputFile=${reportFile}`];
  // Execute the installed Vitest CLI directly; Windows .cmd quoting never enters the path.
  const result = spawnSync(process.execPath, [vitestCli, ...runArgs], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  let report = null;
  if (existsSync(reportFile)) report = JSON.parse(readFileSync(reportFile, 'utf8'));
  const failedTests = (report?.testResults || []).flatMap((suite) =>
    (suite.assertionResults || [])
      .filter((assertion) => assertion.status === 'failed')
      .map((assertion) => assertion.fullName || assertion.title),
  );
  const failedLoads = (report?.testResults || []).filter(
    (suite) => suite.status === 'failed' && !(suite.assertionResults || []).length,
  );
  const loadError =
    failedLoads.length > 0 ||
    /SyntaxError|Transform failed|Failed to resolve import|Cannot find module|No test files found|Error while loading/i.test(
      output,
    );
  const invalid = Boolean(result.error || result.signal || !report || loadError);
  const killed = result.status !== 0 && failedTests.length > 0 && !invalid;
  return {
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.message || null,
    totalTests: report?.numTotalTests ?? 0,
    failedTests,
    failedLoads: failedLoads.map((suite) => suite.name),
    invalid,
    killed,
    outputTail: invalid ? output.slice(-2200) : undefined,
  };
}

try {
  console.log('Serial mutation audit: keep server sources unchanged until this command exits.');
  const baseline = runTests('baseline');
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
      outcome = runTests(mutation.id);
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
  audit.complete = audit.mutations.length === 20;
  audit.passed = audit.complete && audit.caught >= 19 && audit.invalid === 0;
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
    `Caught ${audit.caught}/20; survived ${audit.survived}; invalid ${audit.invalid}; required >=19.`,
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
