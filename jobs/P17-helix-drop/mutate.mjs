// Plant real source mutations serially, run only the fast game rule tests, restore in finally.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const base = 'games/helix-drop/server/';
const mutations = [
  ['score current attempt instead of best', 'scoring.ts', '[r.id, r.best]', '[r.id, r.floor]'],
  ['negate depth score', 'scoring.ts', '[r.id, r.best]', '[r.id, -r.best]'],
  [
    'results available before terminal phase',
    'scoring.ts',
    "state.phase.id !== 'done'",
    "state.phase.id === 'done'",
  ],
  ['double rotation speed', 'types.ts', 'ROTATION_SPEED = 150', 'ROTATION_SPEED = 300'],
  ['halve gravity', 'types.ts', 'GRAVITY = 14', 'GRAVITY = 7'],
  ['downward bounce impulse', 'types.ts', 'BOUNCE = -4.2', 'BOUNCE = 4.2'],
  ['remove fall speed cap', 'types.ts', 'MAX_FALL = 8', 'MAX_FALL = 80'],
  ['stuck steering lease', 'types.ts', 'HOLD_MS = 800', 'HOLD_MS = 8000'],
  ['shorten recovery beat', 'types.ts', 'RESPAWN_MS = 1200', 'RESPAWN_MS = 600'],
  ['two-gap shield instead of three', 'world.ts', 'runner.chain >= 3', 'runner.chain >= 2'],
  [
    'never consume smash charge',
    'world.ts',
    'chain: smash ? 0 : runner.chain + 1',
    'chain: runner.chain + 1',
  ],
  ['danger charges two lives', 'world.ts', 'runner.lives - 1', 'runner.lives - 2'],
  ['recovery erases best depth', 'world.ts', 'best: runner.best,', 'best: 0,'],
  [
    'deeper floor reduces personal best',
    'world.ts',
    'Math.max(runner.best, floor)',
    'Math.min(runner.best, floor)',
  ],
  ['gap ignores ball edge margin', 'world.ts', '< ring.width / 2 - 4', '<= ring.width / 2'],
  [
    'danger excludes its boundary',
    'world.ts',
    '<= ring.dangerWidth / 2 + 4',
    '< ring.dangerWidth / 2 + 4',
  ],
  ['race exceeds one-minute cap', 'types.ts', 'ROUND_MS = 60_000', 'ROUND_MS = 80_000'],
  [
    'reverse a right hold',
    'phases/play.ts',
    'dir: event.input.dir,',
    'dir: event.input.dir === 1 ? -1 : event.input.dir,',
  ],
  [
    'TV leaks internal steering lease',
    'index.ts',
    'angle: runner.angle,',
    'angle: runner.angle, heldUntil: runner.heldUntil,',
  ],
  ['controller gives all lanes to every phone', 'index.ts', 'stage || !hasPlayer(s, id)', 'true'],
];
const rows = [];
for (let i = 0; i < mutations.length; i++) {
  const [name, file, from, to] = mutations[i];
  const path = base + file;
  const original = readFileSync(path, 'utf8');
  if (!original.includes(from)) throw new Error(`Mutation ${i + 1}: missing target ${from}`);
  let run;
  try {
    writeFileSync(path, original.replace(from, to));
    run = spawnSync(
      process.execPath,
      [
        'node_modules/vitest/vitest.mjs',
        'run',
        'games/helix-drop/__tests__/game.test.ts',
        'games/helix-drop/__tests__/world.test.ts',
        '--maxWorkers=1',
        '--pool=threads',
        '--reporter=json',
      ],
      { encoding: 'utf8', shell: false, timeout: 120_000, maxBuffer: 4_000_000 },
    );
  } finally {
    writeFileSync(path, original);
  }
  let report;
  try {
    report = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')));
  } catch {
    throw new Error(`Mutation ${i + 1} did not produce a JSON test report: ${run.stderr}`);
  }
  const failed = report.numFailedTests ?? 0;
  // A failed import, syntax error or process timeout never counts as a caught planted bug.
  const caught = run.status !== 0 && failed > 0;
  const row = { id: i + 1, name, file, caught, failedTests: failed };
  rows.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync('jobs/P17-helix-drop/MUTATIONS.json', JSON.stringify(rows, null, 2) + '\n');
if (rows.filter((r) => r.caught).length < 19) process.exitCode = 1;
