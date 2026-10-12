// One compiling rules bug at a time, one thread worker, source restored in finally.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
const job = import.meta.dirname;
const root = resolve(job, '../..');
const prefix = 'games/kahoot/server/';
const tests = ['scoring', 'classic-server', 'answer-window', 'vip', 'game'].map(
  (name) => `games/kahoot/__tests__/${name}.test.ts`,
);
const temp = mkdtempSync(resolve(tmpdir(), 'pb-p01-mutations-'));
const reportPath = resolve(temp, 'vitest.json');
const args = [
  resolve(root, 'node_modules/vitest/vitest.mjs'),
  'run',
  ...tests,
  '--maxWorkers=1',
  '--pool=threads',
  '--reporter=json',
  `--outputFile=${reportPath}`,
];
const mutants = [
  ['M01', 'Base points inflated', 'types.ts', 'BASE_POINTS = 500', 'BASE_POINTS = 5000'],
  ['M02', 'Speed bonus inflated', 'types.ts', 'SPEED_MAX_POINTS = 500', 'SPEED_MAX_POINTS = 5000'],
  ['M03', 'Streak cap inflated', 'types.ts', 'STREAK_CAP_POINTS = 300', 'STREAK_CAP_POINTS = 3000'],
  [
    'M04',
    'Streak growth reduced',
    'types.ts',
    'STREAK_STEP_POINTS = 100',
    'STREAK_STEP_POINTS = 10',
  ],
  [
    'M05',
    'Wrong answers retain streaks',
    'scoring.ts',
    'const streak = correct ? (streaks[id] ?? 0) + 1 : 0',
    'const streak = correct ? (streaks[id] ?? 0) + 1 : (streaks[id] ?? 0)',
  ],
  [
    'M06',
    'Streak increments twice',
    'scoring.ts',
    'const streak = correct ? (streaks[id] ?? 0) + 1 : 0',
    'const streak = correct ? (streaks[id] ?? 0) + 2 : 0',
  ],
  [
    'M07',
    'Wrong final wager wins',
    'scoring.ts',
    'if (final) delta = correct ? wager : 0 - wager',
    'if (final) delta = wager',
  ],
  [
    'M08',
    'Wrong answers earn points',
    'scoring.ts',
    'correct && pick ? questionPoints(pick.elapsedMs, answerWindowOf(state) / 1000, streak) : 0',
    'correct && pick ? questionPoints(pick.elapsedMs, answerWindowOf(state) / 1000, streak) : 25',
  ],
  [
    'M09',
    'First pick completes collection',
    'types.ts',
    'ids.every((id) => accepted.has(id))',
    'ids.some((id) => accepted.has(id))',
  ],
  [
    'M10',
    'Duplicate answer replaces first',
    'phases/question.ts',
    'Object.hasOwn(state.picks, event.playerId) ||',
    '',
  ],
  [
    'M11',
    'Wrong question id accepted',
    'phases/question.ts',
    'event.input.questionId !== state.questionIds[state.index] ||',
    '',
  ],
  [
    'M12',
    'Wrong opening stamp accepted',
    'phases/question.ts',
    'event.input.questionStartedAt !== state.phase.startedAt',
    'false',
  ],
  [
    'M13',
    'Disconnected seat answers',
    'phases/question.ts',
    '!state.players[event.playerId]?.connected ||',
    '',
  ],
  [
    'M14',
    'Deadline answer accepted',
    'phases/question.ts',
    'event.now >= closesAt',
    'event.now > closesAt',
  ],
  [
    'M15',
    'Early answer accepted',
    'phases/question.ts',
    'event.now < state.phase.startedAt',
    'false',
  ],
  [
    'M16',
    'Question timer cannot exit',
    'phases/question.ts',
    'return next(state, event.now); return state;',
    'return state; return state;',
  ],
  [
    'M17',
    'Reveal timer cannot exit',
    'phases/reveal.ts',
    'return next(state, event.now);',
    'return (void next, state);',
  ],
  [
    'M18',
    'Reading hold removed',
    'phases/question.ts',
    'if (now >= readableUntil) return next(state, now);',
    'return next(state, now);',
  ],
  [
    'M19',
    'Answer key leaks while asking',
    'views.ts',
    "if (phase === 'question' && classic) view.answerStamp",
    "if (phase === 'question') view.correctIndex = 0; if (phase === 'question' && classic) view.answerStamp",
  ],
  [
    'M20',
    'All podium tiers unveiled immediately',
    'standings.ts',
    'r.rank >= current && r.rank <= 3',
    'r.rank <= 3 && current >= 1',
  ],
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const originals = new Map(
  mutants.map(([, , file]) => {
    const path = resolve(root, prefix + file);
    return [path, readFileSync(path)];
  }),
);
function change(source, anchor, replacement, id) {
  const positions = [];
  let compact = '';
  for (let i = 0; i < source.length; i++) {
    if (/\s/.test(source[i])) continue;
    compact += source[i];
    positions.push(i);
  }
  const needle = anchor.replace(/\s/g, '');
  const at = compact.indexOf(needle);
  // M19 intentionally targets the TV branch only; other sites must be unique.
  if (at < 0 || (id !== 'M19' && compact.indexOf(needle, at + 1) >= 0))
    throw new Error(`${id}: expected one mutation site`);
  return (
    source.slice(0, positions[at]) +
    replacement +
    source.slice(positions[at + needle.length - 1] + 1)
  );
}
function runRules() {
  rmSync(reportPath, { force: true });
  const run = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 300_000,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PB_WRITE_EVIDENCE: '0', NO_COLOR: '1' },
  });
  if (run.error) throw run.error;
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const assertions = report.testResults.flatMap((suite) => suite.assertionResults ?? []);
  const failed = assertions
    .filter((test) => test.status === 'failed')
    .map((test) => ({
      name: test.fullName,
      message:
        test.failureMessages[0]?.split('\n').find((line) => line.includes('AssertionError')) ??
        test.failureMessages[0]?.split('\n')[0] ??
        '',
    }));
  if (!assertions.length || (report.numFailedTestSuites > 0 && !failed.length))
    throw new Error('Loading/tool failure is not a killed mutation');
  return { exitCode: run.status, tests: assertions.length, failed };
}
// Validate all sites before running any worker, so formatting drift costs no repeated tests.
for (const [id, , file, anchor, replacement] of mutants)
  change(originals.get(resolve(root, prefix + file)).toString('utf8'), anchor, replacement, id);
if (process.env.PB_MUTATION_VALIDATE === '1') {
  rmSync(temp, { recursive: true, force: true });
  console.log(`Validated ${mutants.length} unique mutation sites`);
  process.exit(0);
}
const results = [];
try {
  const baseline = runRules();
  if (baseline.exitCode !== 0 || baseline.failed.length)
    throw new Error('Unmutated baseline is not green');
  console.log(`Baseline: ${baseline.tests} assertions passed`);
  for (const [id, description, file, anchor, replacement] of mutants) {
    const path = resolve(root, prefix + file);
    const original = originals.get(path);
    let outcome;
    try {
      writeFileSync(path, change(original.toString('utf8'), anchor, replacement, id), 'utf8');
      outcome = runRules();
    } finally {
      writeFileSync(path, original);
    }
    const status = outcome.exitCode !== 0 && outcome.failed.length ? 'killed' : 'survived';
    results.push({ id, description, file: prefix + file, status, ...outcome });
    console.log(`${id}: ${status}, ${outcome.failed.length} behavioral assertions`);
  }
  const killed = results.filter((result) => result.status === 'killed').length;
  const evidence = {
    command: 'node jobs/P01-quiz-rush/mutate-upgrade.mjs',
    testCommand: `node node_modules/vitest/vitest.mjs run ${tests.join(' ')} --maxWorkers=1 --pool=threads --reporter=json`,
    baselineTests: baseline.tests,
    mutations: mutants.length,
    killed,
    invalidMutations: 0,
    sourceHashes: Object.fromEntries(
      [...originals].map(([path, bytes]) => [
        path.slice(root.length + 1).replaceAll('\\', '/'),
        hash(bytes),
      ]),
    ),
    results,
  };
  writeFileSync(
    resolve(job, 'media/mutation-upgrade.json'),
    JSON.stringify(evidence, null, 2) + '\n',
    'utf8',
  );
  console.log(`${killed}/${mutants.length} meaningful mutations detected`);
  if (killed < 19) process.exitCode = 1;
} finally {
  for (const [path, bytes] of originals) writeFileSync(path, bytes);
  for (const [path, bytes] of originals)
    if (hash(readFileSync(path)) !== hash(bytes)) throw new Error(`Restoration failed: ${path}`);
  if (!temp.startsWith(resolve(tmpdir(), 'pb-p01-mutations-')))
    throw new Error('Unsafe temp cleanup');
  rmSync(temp, { recursive: true, force: true });
}
