// Plant one meaningful bug at a time, prove tests fail, and restore exact bytes in every outcome.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const gamePath = 'games/tile-tempo/server/';
const mutants = [
  ['correct-double', 'phases/play.ts', /correct \? 1 : 0/, 'correct ? 2 : 0'],
  ['correct-zero', 'phases/play.ts', /correct \? 1 : 0/, 'correct ? 0 : 0'],
  ['miss-scores', 'phases/play.ts', /correct \? 1 : 0/, 'correct ? 1 : 1'],
  ['wrong-stays-alive', 'phases/play.ts', /out: !correct/, 'out: false'],
  ['correct-eliminates', 'phases/play.ts', /out: !correct/, 'out: correct'],
  [
    'wrong-column-forgotten',
    'phases/play.ts',
    /wrongColumn: correct \? null : event\.input\.column/,
    'wrongColumn: null',
  ],
  ['rows-replayed', 'phases/play.ts', /event\.input\.row !== run\.tiles/, 'false'],
  [
    'disconnected-accepted',
    'phases/play.ts',
    /!state\.players\[event\.playerId\]\?\.connected/,
    'false',
  ],
  [
    'deadline-inclusive',
    'phases/play.ts',
    /if \(event\.now >= state\.endsAt\)/,
    'if (event.now > state.endsAt)',
  ],
  [
    'clock-never-exits',
    'phases/play.ts',
    /now >= state\.endsAt \|\| allOut\(judged\)/,
    'false || allOut(judged)',
  ],
  [
    'lone-survivor-ends',
    'phases/play.ts',
    /Object\.values\(state\.runs\)\.every\(\(run\) => run\.out\)/,
    'Object.values(state.runs).filter((run) => !run.out).length <= 1',
  ],
  ['premature-results', 'scoring.ts', /state\.phase\.id !== 'done'/, "state.phase.id !== 'score'"],
  ['scores-negative', 'scoring.ts', /\[id, run\.tiles\]/, '[id, -run.tiles]'],
  ['scores-bonus', 'scoring.ts', /\[id, run\.tiles\]/, '[id, run.tiles + 1]'],
  ['ready-too-long', 'types.ts', /READY_MS = 3000/, 'READY_MS = 4000'],
  ['play-too-long', 'types.ts', /PLAY_MS = 30_000/, 'PLAY_MS = 45_000'],
  ['score-too-short', 'types.ts', /SCORE_MS = 6000/, 'SCORE_MS = 3000'],
  [
    'tv-course-leak',
    'views.ts',
    /timerMode: 'hidden',\s*deadline: deadline\(state\),\s*\.\.\.raceView\(state\)/,
    "timerMode: 'hidden', deadline: deadline(state), ...raceView(state), sequence: state.sequence",
  ],
  [
    'phone-course-leak',
    'views.ts',
    /state\.sequence\.slice\(run!\.tiles, run!\.tiles \+ 4\)/,
    'state.sequence',
  ],
  [
    'spectator-notes-leak',
    'views.ts',
    /(\? state\.sequence\.slice\(run!\.tiles, run!\.tiles \+ 4\)\s*:)\s*\[\]/,
    '$1 [0, 1, 2, 3]',
  ],
];
const args = [
  resolve(root, 'node_modules/vitest/vitest.mjs'),
  'run',
  'games/tile-tempo/__tests__/game.test.ts',
  'games/tile-tempo/__tests__/views.test.ts',
  '--maxWorkers',
  '1',
];
function runTests() {
  // A direct Node child avoids a cmd/pnpm grandchild retaining the test pipes on Windows.
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.signal)
    throw new Error(`test process failed: ${result.error ?? result.signal}`);
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}
if (process.argv.includes('--check-patterns')) {
  for (const [id, file, pattern] of mutants) {
    const original = readFileSync(resolve(root, gamePath, file), 'utf8');
    if (!pattern.test(original))
      throw new Error(`mutation ${id}: source pattern no longer matches ${file}`);
  }
  process.stdout.write(`all ${mutants.length} mutation patterns match current source\n`);
  process.exit(0);
}
const baseline = runTests();
if (baseline.status !== 0) {
  process.stderr.write(baseline.output);
  throw new Error('mutation check requires a green baseline');
}
const results = [];
for (const [id, file, pattern, replacement] of mutants) {
  const path = resolve(root, gamePath, file);
  const original = readFileSync(path, 'utf8');
  if (!pattern.test(original))
    throw new Error(`mutation ${id}: source pattern no longer matches ${file}`);
  const changed = original.replace(pattern, replacement);
  try {
    writeFileSync(path, changed, 'utf8');
    const result = runTests();
    // A syntax/import failure is not evidence that an assertion caught a behavioral bug.
    const assertionFailure =
      /AssertionError|expected .*(?:to |not to)|FAIL.*(?:race|clock|private|seeded)/s.test(
        result.output,
      );
    const caught = result.status !== 0 && assertionFailure;
    results.push({
      id,
      file,
      caught,
      exitCode: result.status,
      originalSha256: createHash('sha256').update(original).digest('hex'),
    });
    process.stdout.write(`${caught ? 'CAUGHT' : 'SURVIVED'} ${id}\n`);
    if (!caught && result.status !== 0) process.stderr.write(result.output.slice(-2000));
  } finally {
    writeFileSync(path, original, 'utf8');
  }
}
const caught = results.filter((result) => result.caught).length;
const report = { game: 'tile-tempo', planted: mutants.length, caught, required: 19, results };
writeFileSync(
  fileURLToPath(new URL('../MUTATIONS.json', import.meta.url)),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${caught}/${mutants.length} mutations caught; every source restored\n`);
if (caught < 19) process.exitCode = 1;
