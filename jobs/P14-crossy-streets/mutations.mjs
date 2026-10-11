import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

// Real mutations of production files, isolated sequential subprocesses, unconditional restore.
// Only fast mechanic tests run: the 1,000-seed property suite is not repeated twenty times.
const base = resolve('games/crossy-streets/server');
const command =
  'pnpm vitest run games/crossy-streets/__tests__/game.test.ts --pool=threads --maxWorkers=1';
const vitest = resolve('node_modules/vitest/vitest.mjs');
const reportPath = resolve('jobs/P14-crossy-streets/mutation-results.json');
const mutants = [
  ['M01', 'score current row instead of highest row', 'scoring.ts', /runner\.maxRow/, 'runner.row'],
  [
    'M02',
    'give a lethal hop a new high score',
    'world.ts',
    /if \(death !== null\) runner = kill\(runner, death, at\);/,
    'if (death !== null) runner = { ...kill(runner, death, at), maxRow: target.row };',
  ],
  [
    'M03',
    'eagle ignores the exact idle deadline',
    'world.ts',
    /at - runner\.lastProgressAt >= IDLE_MS/,
    'at - runner.lastProgressAt > IDLE_MS',
  ],
  [
    'M04',
    'sideways hops reset the eagle clock',
    'world.ts',
    /else if \(target\.row > original\.maxRow\)/,
    'else if (target.row >= original.maxRow)',
  ],
  ['M05', 'remove hop throttling', 'world.ts', /at - original\.lastHopAt < HOP_MS/, 'false'],
  ['M06', 'respawn immediately at the next sample', 'world.ts', /at < runner\.reviveAt/, 'false'],
  [
    'M07',
    'erase the farthest row on death',
    'world.ts',
    /alive: false,/,
    'alive: false, maxRow: 0,',
  ],
  [
    'M08',
    'logs no longer carry runners',
    'world.ts',
    /runner\.x \+ \(lane\.direction \* lane\.speed \* STEP_MS\) \/ 1000/,
    'runner.x',
  ],
  [
    'M09',
    'cars never collide with runners',
    'world.ts',
    /return !objects\.some\([^;]+;/,
    'return true;',
  ],
  [
    'M10',
    'water gaps count as safe land',
    'world.ts',
    /return objects\.some\([^;]+;/,
    'return true;',
  ],
  [
    'M11',
    'trees permit hopping through them',
    'world.ts',
    /\(lane\.kind === 'grass' && blockedAt\(lane, target\.x\)\)/,
    'false',
  ],
  [
    'M12',
    'side edges no longer kill',
    'world.ts',
    /if \(runner\.x < -0\.25 \|\| runner\.x > WIDTH - 0\.75\) return 'edge';/,
    'if (runner.x < -0.25 || runner.x > WIDTH - 0.75) return null;',
  ],
  [
    'M13',
    'judge only the last sample of a delayed timer',
    'world.ts',
    /let at = world\.stepped \+ STEP_MS/,
    'let at = until',
  ],
  ['M14', 'race lasts 61 seconds', 'index.ts', /seconds: 60,/, 'seconds: 61,'],
  [
    'M15',
    'accept a timer before its deadline',
    'phases/play.ts',
    /event\.now >= state\.phase\.deadline/,
    'true',
  ],
  [
    'M16',
    'accept stale or wrong-phase timer keys',
    'phases/play.ts',
    /isTimerFor\(state, event\)/,
    'true',
  ],
  ['M17', 'score phase never exits', 'phases/score.ts', /\? next\(state, event\.now\)/, '? state'],
  [
    'M18',
    'leak the authoritative RNG into stage views',
    'index.ts',
    /function matchView\(([^]*?)return \{/,
    'function matchView($1return { rng: state.rng,',
  ],
  [
    'M19',
    'send every future lane to every screen',
    'index.ts',
    /\.slice\(startRow, endRow \+ 1\)/,
    '.slice(0)',
  ],
  [
    'M20',
    'resume without shifting the simulation epoch',
    'index.ts',
    /began: state\.began \+ ms/,
    'began: state.began',
  ],
];

function run() {
  const started = performance.now();
  const processResult = spawnSync(
    process.execPath,
    [
      vitest,
      'run',
      'games/crossy-streets/__tests__/game.test.ts',
      '--pool=threads',
      '--maxWorkers=1',
    ],
    { encoding: 'utf8', timeout: 90_000 },
  );
  if (processResult.error) throw processResult.error;
  const output = `${processResult.stdout ?? ''}\n${processResult.stderr ?? ''}`.replace(
    /\u001b\[[0-9;]*m/g,
    '',
  );
  return {
    exitCode: processResult.status,
    wallMs: Math.round(performance.now() - started),
    output,
  };
}

console.log(`Mutation runner PID ${process.pid}; sequential Vitest thread pool, one worker.`);
const baseline = run();
if (baseline.exitCode !== 0)
  throw new Error(`Baseline must pass before planting bugs.\n${baseline.output}`);
const records = [];
for (const [id, bug, file, pattern, replacement] of mutants) {
  const path = resolve(base, file);
  const source = readFileSync(path, 'utf8');
  if (!pattern.test(source))
    throw new Error(`${id}: production source no longer matches mutation pattern`);
  const patched = source.replace(pattern, replacement);
  if (source === patched) throw new Error(`${id}: no mutation was planted`);
  let result;
  try {
    writeFileSync(path, patched, 'utf8');
    result = run();
  } finally {
    writeFileSync(path, source, 'utf8');
  }
  // A transform failure is not evidence that assertions caught a behavioral mutation.
  const behavioral = /Test Files\s+\d+ failed|Tests\s+\d+ failed|FAIL\s+games\//.test(
    result.output,
  );
  const caught =
    result.exitCode !== 0 &&
    behavioral &&
    !/Transform failed|Failed to load url/.test(result.output);
  const failures = result.output
    .split('\n')
    .filter((line) => /FAIL\s+games\/|×|AssertionError/.test(line))
    .map((line) => line.trim());
  const record = {
    id,
    bug,
    file,
    planted: true,
    caught,
    exitCode: result.exitCode,
    wallMs: result.wallMs,
    failures,
  };
  records.push(record);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        command: 'node jobs/P14-crossy-streets/mutations.mjs',
        testCommand: command,
        process: 'Node invokes node_modules/vitest/vitest.mjs directly (no Windows shim)',
        baseline: { exitCode: baseline.exitCode, wallMs: baseline.wallMs },
        planted: records.length,
        caught: records.filter((entry) => entry.caught).length,
        records,
        restored: null,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log(`${id} ${caught ? 'CAUGHT' : 'SURVIVED'} ${bug}`);
}
const restored = run();
if (restored.exitCode !== 0) throw new Error(`Restored baseline failed.\n${restored.output}`);
const report = {
  command: 'node jobs/P14-crossy-streets/mutations.mjs',
  testCommand: command,
  process: 'Node invokes node_modules/vitest/vitest.mjs directly (no Windows shim)',
  baseline: { exitCode: baseline.exitCode, wallMs: baseline.wallMs },
  planted: records.length,
  caught: records.filter((record) => record.caught).length,
  records,
  restored: { exitCode: restored.exitCode, wallMs: restored.wallMs },
};
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`${report.caught}/${report.planted} behavioral bugs caught; original files restored.`);
if (report.caught < 19) process.exitCode = 1;
