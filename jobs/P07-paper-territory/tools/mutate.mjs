// Run from the repo root: node jobs/P07-paper-territory/tools/mutate.mjs
// A compile/tool failure never counts as a catch. Every trial restores original
// source bytes in finally; an outer finally also restores and checks a green baseline.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const prefix = 'games/paper-io/server/';
const trials = [
  ['M01', 'inflate area scores', 'scoring.ts', '[r.id, r.area]', '[r.id, r.area + 1]'],
  ['M02', 'score timer never finishes', 'phases/score.ts', 'next(state, event.now)', 'state'],
  [
    'M03',
    'play cap never exits',
    'phases/play.ts',
    'settled.checked >= ROUND_MS ? next(settled, now)',
    'false ? next(settled, now)',
  ],
  [
    'M04',
    'respawn after one second instead of three',
    'types.ts',
    'export const RESPAWN_TICKS = 15;',
    'export const RESPAWN_TICKS = 5;',
  ],
  [
    'M05',
    'allow reversal into the preceding tile',
    'world.ts',
    'input.dir === (runner.dir + 2) % 4 ||',
    'false ||',
  ],
  [
    'M06',
    'wrap right edge into the next row',
    'world.ts',
    '(dir === 1 && x === width - 1)',
    '(dir === 1 && false)',
  ],
  [
    'M07',
    'flood fill treats rival land as the blocking wall',
    'world.ts',
    'world.owners.map((owner) => owner === slot)',
    'world.owners.map((owner) => owner !== slot)',
  ],
  [
    'M08',
    'drawn trail does not seal a loop',
    'world.ts',
    'for (const cell of trail) blocked[cell] = true;',
    'for (const cell of trail) blocked[cell] = false;',
  ],
  [
    'M09',
    'never award enclosed interior cells',
    'world.ts',
    'if (!blocked[cell] && !outside[cell]) claims.add(cell);',
    'if (false) claims.add(cell);',
  ],
  [
    'M10',
    'forbid stealing enclosed rival land',
    'world.ts',
    'world.homes[cell] === -1 || world.homes[cell] === slot',
    '(world.homes[cell] === -1 && world.owners[cell] === -1) || world.homes[cell] === slot',
  ],
  [
    'M11',
    'allow claiming protected rival homes',
    'world.ts',
    'world.homes[cell] === -1 || world.homes[cell] === slot',
    'true',
  ],
  [
    'M12',
    'ignore crossing own trail',
    'world.ts',
    "if (r.trail.includes(at)) markDeath(r.slot, 'trail');",
    "if (false) markDeath(r.slot, 'trail');",
  ],
  [
    'M13',
    'a cut kills the cutter instead of the trail owner',
    'world.ts',
    "markDeath(other.slot, 'cut')",
    "markDeath(r.slot, 'cut')",
  ],
  [
    'M14',
    'ignore swapping head collision',
    'world.ts',
    '(at === other.cell && there === r.cell)',
    'false',
  ],
  ['M15', 'ignore two heads converging on one tile', 'world.ts', 'at === there ||', 'false ||'],
  [
    'M16',
    'move disconnected or inactive runners',
    'world.ts',
    '.filter((r) => r.alive && active.has(r.id))',
    '.filter((r) => r.alive)',
  ],
  [
    'M17',
    'retain exposed territory after death',
    'world.ts',
    'owner === slot && world.homes[cell] !== slot ? -1 : owner',
    'owner',
  ],
  [
    'M18',
    'respawn a permanent leaver',
    'world.ts',
    'respawnTick: forever ? null : world.stepped + RESPAWN_TICKS',
    'respawnTick: world.stepped + RESPAWN_TICKS',
  ],
  [
    'M19',
    'last writer wins a contested simultaneous capture',
    'world.ts',
    'claims[cell] === -1 || claims[cell] === r.slot ? r.slot : -2',
    'r.slot',
  ],
  [
    'M20',
    'paused time consumes the match cap',
    'index.ts',
    'endsAt: state.endsAt + pausedFor(state, event.now)',
    'endsAt: state.endsAt',
  ],
].map(([id, description, file, before, after]) => ({
  id,
  description,
  file: prefix + file,
  before,
  after,
}));
const tests = ['world', 'game', 'presence', 'bot'].map(
  (name) => `games/paper-io/__tests__/${name}.test.ts`,
);
const scratch = mkdtempSync(resolve(tmpdir(), 'p07-mutations-'));
const originals = new Map(
  trials.map((trial) => [trial.file, readFileSync(resolve(repo, trial.file))]),
);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const args = [
  'run',
  ...tests,
  '--maxWorkers=1',
  '--reporter=json',
  `--outputFile=${resolve(scratch, 'vitest.json')}`,
];
function run() {
  const path = resolve(scratch, 'vitest.json');
  rmSync(path, { force: true });
  const child = spawnSync(
    process.execPath,
    [resolve(repo, 'node_modules/vitest/vitest.mjs'), ...args],
    { cwd: repo, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 },
  );
  let report;
  try {
    report = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`No Vitest report: ${child.stderr}\n${child.stdout}`);
  }
  return { child, report };
}
const summary = ({ child, report }) => ({
  exitCode: child.status,
  total: report.numTotalTests,
  passed: report.numPassedTests,
  failed: report.numFailedTests,
});
const results = {
  command: `node node_modules/vitest/vitest.mjs ${args.slice(0, -1).join(' ')} --outputFile=<temporary report>`,
  baseline: null,
  mutations: [],
  restored: false,
  sourceRestoration: [],
  finalBaseline: null,
};
try {
  const baseline = run();
  results.baseline = summary(baseline);
  if (
    baseline.child.status !== 0 ||
    baseline.report.numFailedTests !== 0 ||
    baseline.report.numTotalTests < 30
  )
    throw new Error('Baseline must be green before source mutation');
  console.log(`Baseline ${baseline.report.numPassedTests} passed.`);
  for (const trial of trials) {
    const original = originals.get(trial.file);
    const source = original.toString('utf8');
    if (source.split(trial.before).length !== 2)
      throw new Error(
        `${trial.id}: source pattern must match exactly once: ${JSON.stringify(trial.before)}`,
      );
    let measured;
    try {
      writeFileSync(resolve(repo, trial.file), source.replace(trial.before, trial.after), 'utf8');
      measured = run();
    } finally {
      writeFileSync(resolve(repo, trial.file), original);
    }
    const { child, report } = measured;
    const failures = report.testResults
      .flatMap((file) => file.assertionResults ?? [])
      .filter((test) => test.status === 'failed');
    const caught =
      child.status === 1 &&
      report.numTotalTests === baseline.report.numTotalTests &&
      failures.length > 0;
    results.mutations.push({
      ...trial,
      originalSha256: sha(original),
      mutatedSha256: sha(Buffer.from(source.replace(trial.before, trial.after))),
      ...summary(measured),
      caught,
      failureTests: failures.map((test) => ({
        test: test.fullName,
        reason: (test.failureMessages ?? []).map((message) =>
          message.split('\n').slice(0, 3).join('\n'),
        ),
      })),
    });
    console.log(
      `${trial.id}: ${caught ? 'CAUGHT' : 'SURVIVED'} (${failures.length} failed assertions) — ${trial.description}`,
    );
    if (
      report.numTotalTests !== baseline.report.numTotalTests ||
      (child.status !== 0 && failures.length === 0)
    )
      throw new Error(`${trial.id}: tool/compile failure does not count`);
  }
} finally {
  for (const [file, bytes] of originals) writeFileSync(resolve(repo, file), bytes);
  results.restored = [...originals].every(
    ([file, bytes]) => sha(readFileSync(resolve(repo, file))) === sha(bytes),
  );
  results.sourceRestoration = [...originals].map(([file, bytes]) => ({
    file,
    beforeSha256: sha(bytes),
    afterSha256: sha(readFileSync(resolve(repo, file))),
    identical: sha(bytes) === sha(readFileSync(resolve(repo, file))),
  }));
  results.finalBaseline = summary(run());
  writeFileSync(
    resolve(repo, 'jobs/P07-paper-territory/tools/mutation-results.json'),
    JSON.stringify(results, null, 2) + '\n',
    'utf8',
  );
  const temporaryRoot = resolve(tmpdir());
  if (!scratch.startsWith(temporaryRoot + sep) || !basename(scratch).startsWith('p07-mutations-'))
    throw new Error('Unsafe scratch cleanup target');
  rmSync(scratch, { recursive: true, force: true });
}
const caught = results.mutations.filter((trial) => trial.caught).length;
console.log(
  `${caught}/20 caught; source restored=${results.restored}; final baseline=${results.finalBaseline.passed} passed.`,
);
if (caught < 19 || !results.restored || results.finalBaseline.exitCode !== 0) process.exitCode = 1;
