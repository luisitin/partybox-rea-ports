import { createHash } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const server = 'games/block-clash/server/';
const reportPath = resolve(root, 'jobs/P11-tetris-clash/tools/.mutation-report.json');
const tests = ['pieces', 'engine', 'game', 'scoring'].map(
  (name) => `games/block-clash/__tests__/${name}.test.ts`,
);

// Each mutation changes executable source once; it is never a mocked expectation.
// The original bytes are restored even on a test process failure or caught exception.
const mutations = [
  ['M01', 'single-line points', 'content.ts', '[0, 100, 300, 500, 800]', '[0, 101, 300, 500, 800]'],
  ['M02', 'double-line points', 'content.ts', '[0, 100, 300, 500, 800]', '[0, 100, 301, 500, 800]'],
  ['M03', 'triple-line points', 'content.ts', '[0, 100, 300, 500, 800]', '[0, 100, 300, 501, 800]'],
  ['M04', 'four-line points', 'content.ts', '[0, 100, 300, 500, 800]', '[0, 100, 300, 500, 801]'],
  ['M05', 'hard-drop distance multiplier', 'engine.ts', '(y - piece.y) * 2', '(y - piece.y) * 1'],
  ['M06', 'combo bonus removed', 'board.ts', 'combo * 50', 'combo * 0'],
  [
    'M07',
    'back-to-back multiplier removed',
    'board.ts',
    'board.b2b ? 1.5 : 1',
    'board.b2b ? 1 : 1',
  ],
  ['M08', 'four-line attack reduced', 'content.ts', '[0, 0, 1, 2, 4]', '[0, 0, 1, 2, 3]'],
  [
    'M09',
    'garbage cancellation removed',
    'board.ts',
    'Math.min(board.pending, attack)',
    'Math.min(board.pending, 0)',
  ],
  [
    'M10',
    'allow repeated hold before locking',
    'engine.ts',
    'if (!board.canHold) return state;',
    'if (false) return state;',
  ],
  ['M11', 'hold never re-enabled on lock', 'board.ts', 'canHold: true,', 'canHold: false,'],
  ['M12', 'receiving garbage cap increased', 'content.ts', 'GARBAGE_CAP = 20', 'GARBAGE_CAP = 21'],
  [
    'M13',
    'garbage lock batch reduced',
    'content.ts',
    'GARBAGE_PER_LOCK = 8',
    'GARBAGE_PER_LOCK = 7',
  ],
  [
    'M14',
    'disable lock-above-ceiling top-out',
    'board.ts',
    'points.some(([, y]) => y < 0)',
    'points.some(([, y]) => y < -10)',
  ],
  [
    'M15',
    'disable blocked spawn top-out',
    'board.ts',
    'if (!fits(board.grid, active))',
    'if (false && !fits(board.grid, active))',
  ],
  [
    'M16',
    'JLSTZ left-wall kick lost',
    'pieces.ts',
    /('12':\s*\[\s*\[0,\s*0\],\s*)\[1,\s*0\]/,
    '$1[0, 0]',
  ],
  [
    'M17',
    'I two-column wall kick reduced',
    'pieces.ts',
    /('12':\s*\[\s*\[0,\s*0\],\s*\[-1,\s*0\],\s*)\[2,\s*0\]/,
    '$1[1, 0]',
  ],
  ['M18', 'round exceeds two-minute cap', 'types.ts', 'ROUND_MS = 120_000', 'ROUND_MS = 121_000'],
  [
    'M19',
    'results timer never exits',
    'phases/score.ts',
    /\?\s*next\(state,\s*event\.now\)/,
    '? state',
  ],
  [
    'M20',
    'board projection leaks hold/sequence/plan',
    'index.ts',
    /return\s*\{\s*id: board\.id,/,
    'return { ...board, id: board.id,',
  ],
];

function runTests() {
  if (existsSync(reportPath)) unlinkSync(reportPath);
  const run = spawnSync(
    process.execPath,
    [
      resolve(root, 'node_modules/vitest/vitest.mjs'),
      'run',
      ...tests,
      '--maxWorkers=1',
      '--reporter=json',
      `--outputFile=${reportPath}`,
    ],
    { cwd: root, encoding: 'utf8', timeout: 120_000, windowsHide: true },
  );
  if (run.error) throw run.error;
  if (!existsSync(reportPath)) throw new Error(`Vitest produced no report: ${run.stderr}`);
  const result = JSON.parse(readFileSync(reportPath, 'utf8'));
  const assertions = result.testResults.flatMap((suite) => suite.assertionResults ?? []);
  const failures = assertions
    .filter((test) => test.status === 'failed')
    .map((test) => test.fullName);
  if (assertions.length === 0) throw new Error(`No assertions executed: ${run.stderr}`);
  return { status: run.status, failures, assertions: assertions.length };
}

function hash(source) {
  return createHash('sha256').update(source).digest('hex');
}

const originals = new Map(
  [...new Set(mutations.map(([, , file]) => file))].map((file) => [
    file,
    readFileSync(resolve(root, server, file), 'utf8'),
  ]),
);
const outcomes = [];
try {
  const baseline = runTests();
  if (baseline.status !== 0 || baseline.failures.length)
    throw new Error(`Baseline fails: ${baseline.failures.join('; ')}`);
  console.log(`Baseline: ${baseline.assertions} passing assertions`);
  for (const [id, bug, file, from, to] of mutations) {
    const original = originals.get(file);
    const matches =
      typeof from === 'string'
        ? original.split(from).length - 1
        : (original.match(new RegExp(from.source, 'g')) ?? []).length;
    if (matches !== 1)
      throw new Error(`${id}: mutation anchor matched ${matches} times in ${file}`);
    const path = resolve(root, server, file);
    try {
      writeFileSync(path, original.replace(from, to), 'utf8');
      const result = runTests();
      const caught = result.status !== 0 && result.failures.length > 0;
      outcomes.push({ id, bug, file, caught, failingTests: result.failures });
      console.log(
        `${id} ${caught ? 'CAUGHT' : 'SURVIVED'}: ${bug}; ${result.failures[0] ?? 'no failing assertion'}`,
      );
    } finally {
      writeFileSync(path, original, 'utf8');
    }
  }
} finally {
  for (const [file, original] of originals) {
    const path = resolve(root, server, file);
    if (hash(readFileSync(path, 'utf8')) !== hash(original)) writeFileSync(path, original, 'utf8');
  }
  if (existsSync(reportPath)) unlinkSync(reportPath);
}
const caught = outcomes.filter((m) => m.caught).length;
const report = { total: mutations.length, caught, sourceRestored: true, outcomes };
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0)
  writeFileSync(
    resolve(root, process.argv[outIndex + 1]),
    JSON.stringify(report, null, 2) + '\n',
    'utf8',
  );
console.log(JSON.stringify({ total: mutations.length, caught, sourceRestored: true }));
if (caught < 19) process.exitCode = 1;
