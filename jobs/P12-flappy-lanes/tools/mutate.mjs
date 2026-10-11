// Run only after all server edits pause: node jobs/P12-flappy-lanes/tools/mutate.mjs
// Mutates one real source file, runs the real scoped rule tests, and restores it
// in finally. Compile errors do not count as caught mutations.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const gameDir = 'games/flappy-lanes/server/';
const mutations = [
  [
    'ties earn points',
    'scoring.ts',
    '(b.died ?? Infinity) < (a.died ?? Infinity)',
    '(b.died ?? Infinity) <= (a.died ?? Infinity)',
  ],
  ['survivors rank as first dead', 'scoring.ts', '(b.died ?? Infinity)', '(b.died ?? 0)'],
  ['scores replace previous rounds', 'phases/score.ts', '(scores[id] ?? 0) + points', 'points'],
  ['one extra round', 'index.ts', 's.round >= s.settings.rounds', 's.round > s.settings.rounds'],
  ['one survivor does not finish', 'world.ts', 'aliveCount(world) <= 1', 'aliveCount(world) <= 0'],
  ['flap cooldown removed', 'world.ts', 't - bird.lastFlap < COOLDOWN_MS', 't - bird.lastFlap < 0'],
  ['flap has no upward impulse', 'world.ts', 'v: FLAP_V', 'v: 0'],
  [
    'gravity displacement doubled',
    'world.ts',
    '(GRAVITY * accelerated ** 2) / 2',
    'GRAVITY * accelerated ** 2',
  ],
  [
    'falling velocity is unbounded',
    'world.ts',
    'Math.min(FALL_V, bird.flight.v + GRAVITY * dt)',
    'bird.flight.v + GRAVITY * dt',
  ],
  ['top ignores bird radius', 'world.ts', 'y - R <= 0', 'y <= 0'],
  ['floor ignores bird radius', 'world.ts', 'y + R >= H', 'y >= H'],
  [
    'gap edge ignores bird radius',
    'world.ts',
    'y + R >= g.center + GAP / 2',
    'y >= g.center + GAP / 2',
  ],
  ['horizontal collision ignores radius', 'world.ts', 'gx <= X + R', 'gx <= X'],
  [
    'gate counts before its trailing edge clears',
    'world.ts',
    'g.x + GATE_WIDTH - distance < X - R',
    'g.x - distance < X',
  ],
  [
    'world cap removed',
    'world.ts',
    'Math.min(ROUND_MS, Math.floor(to / STEP_MS) * STEP_MS)',
    'Math.floor(to / STEP_MS) * STEP_MS',
  ],
  [
    'judges a sample in the future',
    'world.ts',
    'Math.floor(to / STEP_MS)',
    'Math.ceil(to / STEP_MS)',
  ],
  [
    'future gates leak',
    'world.ts',
    'g.x - distance <= W && g.x + GATE_WIDTH - distance >= 0',
    'true || g.x - distance <= W && g.x + GATE_WIDTH - distance >= 0',
  ],
  ['stale play timer accepted', 'phases/play.ts', 'isTimerFor(state, event)', 'true'],
  ['resume leaves start clock behind', 'index.ts', 'began: s.began + ms', 'began: s.began'],
  [
    'flap rescues an already overlapping bird',
    'world.ts',
    'b.died === null && collides(world, b, t)',
    'b.died === null && false',
  ],
];

const originals = new Map();
for (const [, file, from] of mutations) {
  const path = resolve(root, gameDir, file);
  if (!originals.has(path)) originals.set(path, readFileSync(path, 'utf8'));
  const source = originals.get(path);
  if (source.split(from).length !== 2)
    throw new Error(`${file}: mutation anchor must occur once: ${from}`);
}
const temp = mkdtempSync(join(tmpdir(), 'flappy-lanes-mutations-'));
const reportPath = join(temp, 'report.json');
const cli = join(root, 'node_modules/vitest/vitest.mjs');
const runTests = () => {
  try {
    execFileSync(
      process.execPath,
      [
        cli,
        'run',
        'games/flappy-lanes/__tests__/rules.test.ts',
        '--maxWorkers=1',
        '--pool=threads',
        '--reporter=json',
        `--outputFile=${reportPath}`,
      ],
      // Evidence goes to reportPath. Avoid extra inherited Windows pipe handles.
      { cwd: root, stdio: 'ignore' },
    );
  } catch (error) {
    if (!error.status) throw error;
  }
  return JSON.parse(readFileSync(reportPath, 'utf8'));
};
const results = [];
try {
  const baseline = runTests();
  if (baseline.numFailedTests || !baseline.numPassedTests)
    throw new Error('Baseline rule tests must pass');
  for (const [index, [name, file, from, to]] of mutations.entries()) {
    const path = resolve(root, gameDir, file);
    const original = originals.get(path);
    try {
      writeFileSync(path, original.replace(from, to), 'utf8');
      const run = runTests();
      const caughtBy = run.testResults.flatMap((suite) =>
        suite.assertionResults
          .filter((test) => test.status === 'failed')
          .map((test) => test.fullName),
      );
      const caught = run.numFailedTests > 0 && caughtBy.length > 0;
      results.push({ number: index + 1, name, file: `${gameDir}${file}`, caught, caughtBy });
      console.log(`${index + 1}/20 ${caught ? 'CAUGHT' : 'SURVIVED'} ${name}`);
    } finally {
      writeFileSync(path, original, 'utf8');
    }
  }
} finally {
  for (const [path, original] of originals) writeFileSync(path, original, 'utf8');
  try {
    unlinkSync(reportPath);
  } catch {
    /* no report if startup failed */
  }
  rmdirSync(temp);
}
const caught = results.filter((r) => r.caught).length;
const sourceHashes = Object.fromEntries(
  [...originals].map(([path, original]) => {
    if (readFileSync(path, 'utf8') !== original)
      throw new Error(`Original was not restored: ${path}`);
    return [
      path.slice(root.length).replaceAll('\\', '/'),
      createHash('sha256').update(original).digest('hex'),
    ];
  }),
);
writeFileSync(
  fileURLToPath(new URL('../mutations.json', import.meta.url)),
  `${JSON.stringify({ planted: mutations.length, caught, originalsRestored: true, sourceHashes, results }, null, 2)}\n`,
  'utf8',
);
if (caught < 19) process.exitCode = 1;
