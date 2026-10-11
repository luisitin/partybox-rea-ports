// Real serial source mutations; every source is restored even if a command throws.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const command =
  'pnpm.cmd vitest run games/dino-dash/__tests__/game.test.ts games/dino-dash/__tests__/views.test.ts --maxWorkers=1';
const bugs = [
  [
    'M01',
    'Round points round up',
    'scoring.ts',
    /Math\.floor\(r\.distance \/ 10\)/,
    'Math.ceil(r.distance / 10)',
  ],
  [
    'M02',
    'Distance converts at wrong scale',
    'scoring.ts',
    /r\.distance \/ 10/,
    'r.distance / 100',
  ],
  [
    'M03',
    'New round replaces cumulative points',
    'scoring.ts',
    /\(scores\[id\] \?\? 0\) \+ metres/,
    'metres',
  ],
  [
    'M04',
    'Results published during play',
    'scoring.ts',
    /state\.phase\.id === 'done'/,
    "state.phase.id === 'play'",
  ],
  [
    'M05',
    'Final-round test uses strict greater-than',
    'index.ts',
    /state\.round >= state\.settings\.rounds/,
    'state.round > state.settings.rounds',
  ],
  ['M06', 'Round number does not increment', 'index.ts', /state\.round \+ 1/, 'state.round'],
  [
    'M07',
    'Early timer accepted and on-time timer refused',
    'phases/play.ts',
    /event\.now >= \(state\.phase\.deadline \?\? Infinity\)/,
    'event.now <= (state.phase.deadline ?? Infinity)',
  ],
  ['M08', 'Stale timer instances accepted', 'phases/play.ts', /isTimerFor\(state, event\)/, 'true'],
  [
    'M09',
    'All-dead round fails to exit before cap',
    'phases/play.ts',
    /state\.world\.checked >= ROUND_MS \|\| allDead\(state\.world\)/,
    'state.world.checked >= ROUND_MS && allDead(state.world)',
  ],
  [
    'M10',
    'Collisions never kill',
    'world.ts',
    /obstacle && collides\(runner, obstacle, ms\)/,
    'obstacle && false',
  ],
  [
    'M11',
    'Dead runner continues earning distance',
    'world.ts',
    /if \(runner\.died !== null\) continue;/,
    'if (false) continue;',
  ],
  [
    'M12',
    'Crouching body is too tall for bird',
    'world.ts',
    /DUCK_HEIGHT = 22/,
    'DUCK_HEIGHT = 40',
  ],
  ['M13', 'Gravity doubles', 'world.ts', /GRAVITY = 1800/, 'GRAVITY = 3600'],
  ['M14', 'Wrong starting speed', 'world.ts', /START_SPEED = 360/, 'START_SPEED = 380'],
  [
    'M15',
    'Crash distance uses wrong time sample',
    'world.ts',
    /runner\.distance = distance;/,
    'runner.distance = distance + 100;',
  ],
  [
    'M16',
    'Disconnect leaves duck latched',
    'index.ts',
    /duck: false,\s*died: e\.gone/,
    'duck: true, died: e.gone',
  ],
  [
    'M17',
    'Resume fails to shift run origin',
    'index.ts',
    /began: s\.began \+ ms/,
    'began: s.began',
  ],
  [
    'M18',
    'Unrevealed course is sent over the wire',
    'index.ts',
    /obstacles: visibleCourse\(s\.world\)/,
    'obstacles: s.world.course',
  ],
  [
    'M19',
    'Every phone receives lane zero',
    'index.ts',
    /const slot = state\.world\.runners\.findIndex\(\(r\) => r\.id === playerId\);/,
    'const slot = 0;',
  ],
  [
    'M20',
    'Final tie rank counts equal scores as ahead',
    'index.ts',
    /filter\(\(n\) => n > score\)/,
    'filter((n) => n >= score)',
  ],
];
const originals = new Map();
for (const [, , file] of bugs) {
  const path = join(repo, 'games/dino-dash/server', file);
  if (!originals.has(path)) originals.set(path, readFileSync(path, 'utf8'));
}
const runTests = () => {
  const result =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
          cwd: repo,
          encoding: 'utf8',
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024,
        })
      : spawnSync(
          'pnpm',
          [
            'vitest',
            'run',
            'games/dino-dash/__tests__/game.test.ts',
            'games/dino-dash/__tests__/views.test.ts',
            '--maxWorkers=1',
          ],
          { cwd: repo, encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
        );
  if (result.error) throw result.error;
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, ''),
  };
};
const baseline = runTests();
if (baseline.status !== 0)
  throw new Error(`Baseline tests failed; refusing mutation run.\n${baseline.output}`);
const rows = [];
try {
  for (const [id, bug, file, pattern, replacement] of bugs) {
    const path = join(repo, 'games/dino-dash/server', file);
    const source = originals.get(path);
    if (!pattern.test(source)) throw new Error(`${id} mutation anchor missing: ${pattern}`);
    writeFileSync(path, source.replace(pattern, replacement), 'utf8');
    let result;
    try {
      result = runTests();
    } finally {
      writeFileSync(path, source, 'utf8');
    }
    const assertion = /AssertionError|\bFAIL\b/.test(result.output);
    const infrastructure = /Transform failed|Failed to load|Cannot find module|SyntaxError/.test(
      result.output,
    );
    const killed = result.status !== 0 && assertion && !infrastructure;
    const failures = result.output
      .split('\n')
      .filter((line) => /FAIL|AssertionError/.test(line))
      .slice(0, 12);
    rows.push({ id, bug, file, killed, exitCode: result.status, failures });
    console.log(`${id} ${killed ? 'KILLED' : 'SURVIVED'}: ${bug}`);
  }
} finally {
  for (const [path, source] of originals) writeFileSync(path, source, 'utf8');
}
const finalCheck = runTests();
if (finalCheck.status !== 0) throw new Error(`Restored tests failed.\n${finalCheck.output}`);
const killed = rows.filter((row) => row.killed).length;
const sourceSha256 = createHash('sha256')
  .update(
    [...originals]
      .map(([path, source]) => `${path.replaceAll('\\', '/').split('/server/')[1]}\n${source}`)
      .join('\n'),
  )
  .digest('hex');
writeFileSync(
  join(here, 'mutation-results.json'),
  JSON.stringify(
    {
      command,
      sourceSha256,
      baseline: 'passed',
      restored: 'passed',
      killed,
      total: rows.length,
      rows,
    },
    null,
    2,
  ) + '\n',
  'utf8',
);
writeFileSync(
  join(here, 'MUTATION.md'),
  [
    '# Serial mutation check',
    '',
    `Command: \`node jobs/P13-dino-dash/mutate.mjs\`.`,
    '',
    `Each bug edited real server source, ran \`${command}\`, and restored the file in a finally block.`,
    'The two targeted suites cover physics, scoring, phase exits and views; SDK/property/UI tests were not repeated for each mutation.',
    'Baseline and restored-source checks passed. Compilation/infrastructure errors do not count as kills.',
    '',
    `Result: **${killed}/${rows.length} killed** (required: at least 19/20).`,
    '',
    '| ID | Planted bug | Result |',
    '| --- | --- | --- |',
    ...rows.map((row) => `| ${row.id} | ${row.bug} | ${row.killed ? 'Killed' : 'Survived'} |`),
    '',
    `Mutated source snapshot SHA-256: \`${sourceSha256}\`.`,
    'Detailed failing test names and exit codes are recorded in mutation-results.json.',
    '',
  ].join('\n'),
  'utf8',
);
if (killed < 19) process.exitCode = 1;
