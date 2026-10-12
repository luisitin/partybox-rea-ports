// Twenty independent, compiling behavioral bugs. Run only this game's short unit tests.
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const jobDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(jobDir, '../..');
const server = resolve(root, 'games/agar-io/server');
const resultFile = resolve(jobDir, 'mutation-current.json');
const finalFile = resolve(jobDir, 'mutations.json');
const command =
  'pnpm.cmd vitest run games/agar-io/__tests__/mechanics.test.ts games/agar-io/__tests__/game.test.ts games/agar-io/__tests__/regressions.test.ts --maxWorkers=1 --reporter=json --outputFile=jobs/P05-blob-arena/mutation-current.json';

const mutations = [
  [
    'M01',
    'Score rounds up instead of down',
    'scoring.ts',
    'Math.floor(totalMass(world, id))',
    'Math.ceil(totalMass(world, id))',
  ],
  [
    'M02',
    'Score counts only the largest split part',
    'scoring.ts',
    'Math.floor(totalMass(world, id))',
    'Math.floor(Math.max(0, ...world.cells.filter(c => c.owner === id).map(c => c.mass)))',
  ],
  [
    'M03',
    'New round replaces previously banked points',
    'phases/score.ts',
    'n + (lastPoints[id] ?? 0)',
    '(lastPoints[id] ?? 0)',
  ],
  ['M04', 'Match exits after two rounds', 'index.ts', 'state.round >= 3', 'state.round >= 2'],
  [
    'M05',
    'Timer waits beyond the horn before entering score',
    'phases/play.ts',
    'return now >= s.endsAt',
    'return now >= s.endsAt + 1000',
  ],
  [
    'M06',
    'Horn drops the final physics step',
    'phases/play.ts',
    'Math.min(ROUND_MS, Math.max(0, now - state.began))',
    'Math.min(ROUND_MS - 100, Math.max(0, now - state.began))',
  ],
  [
    'M07',
    'Predator needs only a 1.15 mass ratio',
    'types.ts',
    'export const EAT_RATIO = 1.25;',
    'export const EAT_RATIO = 1.15;',
  ],
  [
    'M08',
    'Grazing edges swallow prey without deep overlap',
    'collisions.ts',
    'if (gap >= radius(predator.mass) - radius(victim.mass) * 0.35) continue;',
    'if (gap >= radius(predator.mass) + radius(victim.mass)) continue;',
  ],
  [
    'M09',
    'A spawn shield does not protect its victim',
    'collisions.ts',
    'if (time < victim.shieldUntil) continue;',
    'if (false) continue;',
  ],
  [
    'M10',
    'Splitting loses a third of the mass',
    'world.ts',
    'const half = c.mass / 2;',
    'const half = c.mass / 3;',
  ],
  [
    'M11',
    'Splitting has no cooldown',
    'types.ts',
    'export const SPLIT_COOLDOWN_MS = 1000;',
    'export const SPLIT_COOLDOWN_MS = 0;',
  ],
  [
    'M12',
    'Splitting is allowed at starting mass',
    'types.ts',
    'export const SPLIT_MIN = 48;',
    'export const SPLIT_MIN = 24;',
  ],
  [
    'M13',
    'The split cap allows eight cells',
    'types.ts',
    'export const MAX_CELLS = 4;',
    'export const MAX_CELLS = 8;',
  ],
  [
    'M14',
    'Siblings unlock merging after one second',
    'types.ts',
    'export const MERGE_MS = 8000;',
    'export const MERGE_MS = 1000;',
  ],
  [
    'M15',
    'A swallowed seat respawns in half the specified time',
    'world.ts',
    'respawns[id] = time + RESPAWN_MS;',
    'respawns[id] = time + RESPAWN_MS / 2;',
  ],
  [
    'M16',
    'Respawns lose their two-second shield',
    'spawn.ts',
    'shieldUntil: world.time + shield,',
    'shieldUntil: world.time,',
  ],
  [
    'M17',
    'A pellet awards double mass',
    'world.ts',
    'eater.mass += PELLET_MASS;',
    'eater.mass += PELLET_MASS * 2;',
  ],
  [
    'M18',
    'An eaten pellet stays available at the same spot',
    'world.ts',
    'return fresh;',
    'return p;',
  ],
  [
    'M19',
    'Resume fails to extend the round end clock',
    'index.ts',
    'endsAt: state.endsAt + ms',
    'endsAt: state.endsAt',
  ],
  [
    'M20',
    'TV view exposes the future random sequence',
    'index.ts',
    "timerMode: 'quiet',",
    "timerMode: 'quiet',\n    ...{ rng: state.rng },",
  ],
].map(([id, name, file, from, to]) => ({ id, name, file, from, to }));

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function runTests() {
  if (existsSync(resultFile)) unlinkSync(resultFile);
  const run =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
          cwd: root,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 180000,
          maxBuffer: 20 * 1024 * 1024,
          env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
        })
      : spawnSync(
          'pnpm',
          [
            'vitest',
            'run',
            'games/agar-io/__tests__/mechanics.test.ts',
            'games/agar-io/__tests__/game.test.ts',
            'games/agar-io/__tests__/regressions.test.ts',
            '--maxWorkers=1',
            '--reporter=json',
            '--outputFile=jobs/P05-blob-arena/mutation-current.json',
          ],
          {
            cwd: root,
            encoding: 'utf8',
            timeout: 180000,
            maxBuffer: 20 * 1024 * 1024,
            env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
          },
        );
  const json = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, 'utf8')) : null;
  const failedTests = (json?.testResults ?? []).flatMap((suite) =>
    (suite.assertionResults ?? [])
      .filter((test) => test.status === 'failed')
      .map((test) => ({ name: test.fullName, failures: test.failureMessages })),
  );
  const brokenSuites = (json?.testResults ?? [])
    .filter(
      (suite) =>
        suite.status === 'failed' &&
        !(suite.assertionResults ?? []).some((test) => test.status === 'failed'),
    )
    .map((suite) => ({ name: suite.name, message: suite.message }));
  return {
    exitCode: run.status,
    success: run.status === 0 && json?.success === true,
    failedTests,
    brokenSuites,
    error: run.error?.message ?? null,
    passedTests: json?.numPassedTests ?? 0,
    totalTests: json?.numTotalTests ?? 0,
    outputTail: `${run.stdout ?? ''}\n${run.stderr ?? ''}`.slice(-4000),
  };
}

const originals = new Map();
const gameFiles = new Map();
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else gameFiles.set(file, digest(readFileSync(file)));
  }
}
collect(resolve(root, 'games/agar-io'));
const historyDir = resolve(jobDir, 'r5-history');
const historyFile = resolve(historyDir, 'mutations.json');
if (existsSync(finalFile) && !existsSync(historyFile)) {
  mkdirSync(historyDir, { recursive: true });
  writeFileSync(historyFile, readFileSync(finalFile));
}
for (const mutation of mutations) {
  const file = resolve(server, mutation.file);
  if (!originals.has(file)) originals.set(file, readFileSync(file));
  const matches = originals.get(file).toString('utf8').split(mutation.from).length - 1;
  if (matches !== 1)
    throw new Error(
      `${mutation.id}: expected exactly one source match, found ${matches}; no mutation was planted`,
    );
}

const baseline = runTests();
if (!baseline.success) {
  writeFileSync(
    finalFile,
    `${JSON.stringify({ command, baseline, mutations: [], killed: 0, total: 20, status: 'baseline-failed' }, null, 2)}\n`,
    'utf8',
  );
  throw new Error('Unmodified mechanics/game tests must pass before mutation testing');
}

const outcomes = [];
try {
  for (const mutation of mutations) {
    const file = resolve(server, mutation.file);
    const original = originals.get(file);
    let tests;
    try {
      writeFileSync(file, original.toString('utf8').replace(mutation.from, mutation.to), 'utf8');
      tests = runTests();
    } finally {
      // Byte-for-byte restoration also preserves CRLF and BOM choices.
      writeFileSync(file, original);
      if (digest(readFileSync(file)) !== digest(original))
        throw new Error(`${mutation.id}: source restoration failed`);
    }
    // A compile/import/transform failure, timeout or empty suite never counts as a killed bug.
    const killed =
      tests.exitCode !== 0 &&
      tests.failedTests.length > 0 &&
      tests.brokenSuites.length === 0 &&
      tests.error === null;
    outcomes.push({ ...mutation, killed, ...tests });
    console.log(
      `${mutation.id} ${killed ? 'caught' : 'survived or invalid'}: ${mutation.name} (${tests.failedTests.length} assertion failures)`,
    );
    writeFileSync(
      finalFile,
      `${JSON.stringify({ command, baseline, mutations: outcomes, killed: outcomes.filter((item) => item.killed).length, total: mutations.length, status: 'running' }, null, 2)}\n`,
      'utf8',
    );
  }
} finally {
  for (const [file, original] of originals) {
    if (digest(readFileSync(file)) !== digest(original)) writeFileSync(file, original);
  }
  if (existsSync(resultFile)) unlinkSync(resultFile);
}

const killed = outcomes.filter((item) => item.killed).length;
writeFileSync(
  finalFile,
  `${JSON.stringify({ command, baseline, mutations: outcomes, killed, total: mutations.length, status: killed >= 19 ? 'passed' : 'failed', sourceFiles: gameFiles.size, sourceRestored: [...gameFiles].every(([file, hash]) => digest(readFileSync(file)) === hash) }, null, 2)}\n`,
  'utf8',
);
console.log(`Mutation score: ${killed}/${mutations.length}; sources restored`);
if (killed < 19) process.exitCode = 1;
