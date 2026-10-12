// Apply one compiling rules bug at a time, run only rule tests, and restore exact source bytes.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const job = dirname(fileURLToPath(import.meta.url));
const root = resolve(job, '../..');
const prefix = 'games/quiz-rush/server/';
const ruleTest = 'games/quiz-rush/__tests__/game.test.ts';
const temp = mkdtempSync(join(tmpdir(), 'quiz-rush-mutations-'));
const reportPath = join(temp, 'vitest.json');
const args = [
  resolve(root, 'node_modules/vitest/vitest.mjs'),
  'run',
  ruleTest,
  '--maxWorkers=1',
  '--reporter=json',
  `--outputFile=${reportPath}`,
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const scoring = 'scoring.ts';
const question = 'phases/question.ts';
const mutants = [
  [
    'M01',
    'Speed points inflated tenfold',
    scoring,
    /Math\.round\(1000 \* \(1 - fraction \/ 2\)\)/,
    'Math.round(10000 * (1 - fraction / 2))',
  ],
  [
    'M02',
    'Slower answers earn more points',
    scoring,
    /Math\.round\(1000 \* \(1 - fraction \/ 2\)\)/,
    'Math.round(1000 * (1 + fraction / 2))',
  ],
  [
    'M03',
    'Speed points round upward instead of nearest',
    scoring,
    /Math\.round\(1000 \* \(1 - fraction \/ 2\)\)/,
    'Math.ceil(1000 * (1 - fraction / 2))',
  ],
  [
    'M04',
    'Elapsed time is not clamped',
    scoring,
    /Math\.max\(0, Math\.min\(1, elapsed \/ Math\.max\(1, duration\)\)\)/,
    'elapsed / Math.max(1, duration)',
  ],
  [
    'M05',
    'Wrong answers and timeouts earn 25 points',
    scoring,
    /const base = right \? speedPoints\(answer!\.elapsed, state\.answerMs\) : 0;/,
    'const base = right ? speedPoints(answer!.elapsed, state.answerMs) : 25;',
  ],
  [
    'M06',
    'Wrong answer preserves a streak',
    scoring,
    /const streak = right \? \(state\.streaks\[id\] \?\? 0\) \+ 1 : 0;/,
    'const streak = right ? (state.streaks[id] ?? 0) + 1 : (state.streaks[id] ?? 0);',
  ],
  [
    'M07',
    'Correct answer increments streak by two',
    scoring,
    /const streak = right \? \(state\.streaks\[id\] \?\? 0\) \+ 1 : 0;/,
    'const streak = right ? (state.streaks[id] ?? 0) + 2 : 0;',
  ],
  [
    'M08',
    'Streak cap rises from 500 to 5000',
    scoring,
    /Math\.min\(500, Math\.max\(0, streak - 1\) \* 100\)/,
    'Math.min(5000, Math.max(0, streak - 1) * 100)',
  ],
  [
    'M09',
    'Streak growth shrinks from 100 to 10',
    scoring,
    /Math\.min\(500, Math\.max\(0, streak - 1\) \* 100\)/,
    'Math.min(500, Math.max(0, streak - 1) * 10)',
  ],
  ['M10', 'Streak bonus omitted from score', scoring, /points: base \+ bonus/, 'points: base'],
  [
    'M11',
    'Last answer leaves question open',
    question,
    /return everyoneAnswered\(after\) \? next\(after, event\.now\) : after;/,
    'return after;',
  ],
  [
    'M12',
    'First answer closes question prematurely',
    question,
    /eligibleIds\(state\)\.every\(\(id\) => Object\.hasOwn\(state\.answers, id\)\)/,
    'eligibleIds(state).some((id) => Object.hasOwn(state.answers, id))',
  ],
  [
    'M13',
    'Duplicate answers overwrite the first choice',
    question,
    /\s*\|\|\s*Object\.hasOwn\(state\.answers, event\.playerId\)/,
    '',
  ],
  [
    'M14',
    'Answers from an old round are accepted',
    question,
    /event\.input\.round !== state\.round \|\|\s*/,
    '',
  ],
  [
    'M15',
    'Pre-start timestamps are accepted',
    question,
    /if \(event\.now < state\.openedAt\) return state;/,
    'if (false) return state;',
  ],
  [
    'M16',
    'Answer at the deadline is accepted',
    question,
    /if \(state\.phase\.deadline !== null && event\.now >= state\.phase\.deadline\) return next\(state, event\.now\);/,
    'if (state.phase.deadline !== null && event.now > state.phase.deadline) return next(state, event.now);',
  ],
  [
    'M17',
    'Disconnected player can answer',
    question,
    /!state\.players\[event\.playerId\]!\.connected \|\|\s*/,
    '',
  ],
  [
    'M18',
    'Pause time is included in speed scoring',
    'index.ts',
    /openedAt: state\.openedAt \+ pausedFor\(state, event\.now\)/,
    'openedAt: state.openedAt',
  ],
  [
    'M19',
    'Answer key is leaked by public question',
    'content.ts',
    /return \{ id: q\.id, prompt: q\.prompt, options: \[\.\.\.q\.options\] \};/,
    'return { ...q, options: [...q.options] };',
  ],
  [
    'M20',
    'All final podium ranks appear on first beat',
    'index.ts',
    /rows\.filter\(\(r\) => r\.rank <= 3 && r\.rank >= 3 - state\.podiumStep\)/,
    'rows',
  ],
];

function runRules() {
  const processResult = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1' },
  });
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    throw new Error(
      `Vitest did not produce a readable report: ${processResult.error?.message ?? processResult.stderr?.slice(-500)}`,
    );
  } finally {
    try {
      unlinkSync(reportPath);
    } catch {
      /* No report on a tool failure. */
    }
  }
  if (processResult.error) throw processResult.error;
  const assertions = report.testResults.flatMap((suite) => suite.assertionResults ?? []);
  const failed = assertions
    .filter((assertion) => assertion.status === 'failed')
    .map((assertion) => ({
      name: assertion.fullName,
      message:
        assertion.failureMessages?.[0]
          ?.split('\n')
          .find((line) => line.includes('AssertionError')) ??
        assertion.failureMessages?.[0]?.split('\n')[0] ??
        '',
    }));
  if (assertions.length === 0 || (report.numFailedTestSuites > 0 && failed.length === 0)) {
    throw new Error(
      `Mutation caused load/compile failure, not a failed behavioral assertion: ${processResult.stderr?.slice(-500)}`,
    );
  }
  return { exitCode: processResult.status, tests: assertions.length, failed };
}

const originals = new Map();
for (const [, , file] of mutants) {
  const path = resolve(root, prefix + file);
  if (!originals.has(path)) originals.set(path, readFileSync(path));
}
const results = [];
// Ignore formatting whitespace when locating semantic anchors, but replace in the original
// byte string. This makes the same twenty mutations reproducible after the final format pass.
function mutationSource(source, pattern, replacement, id) {
  const positions = [];
  let normalized = '';
  for (let index = 0; index < source.length; index++) {
    if (/\s/.test(source[index])) continue;
    normalized += source[index];
    positions.push(index);
  }
  const normalizedPattern = new RegExp(pattern.source.replaceAll(' ', ''), 'g');
  const matches = [...normalized.matchAll(normalizedPattern)];
  if (matches.length !== 1)
    throw new Error(`${id}: expected exactly one mutation site, got ${matches.length}`);
  const match = matches[0];
  const start = positions[match.index];
  const end = positions[match.index + match[0].length - 1] + 1;
  return source.slice(0, start) + replacement + source.slice(end);
}

try {
  const baseline = runRules();
  if (baseline.exitCode !== 0 || baseline.failed.length)
    throw new Error('Unmutated rule baseline is not green');
  console.log(`Baseline: ${baseline.tests} rule tests passed`);
  for (const [id, description, file, pattern, replacement] of mutants) {
    const path = resolve(root, prefix + file);
    const original = originals.get(path);
    const source = original.toString('utf8');
    const changed = mutationSource(source, pattern, replacement, id);
    let outcome;
    try {
      writeFileSync(path, changed, 'utf8');
      outcome = runRules();
    } finally {
      writeFileSync(path, original);
    }
    const status = outcome.exitCode !== 0 && outcome.failed.length > 0 ? 'killed' : 'survived';
    results.push({ id, description, file: prefix + file, status, ...outcome });
    console.log(`${id}: ${status}, ${outcome.failed.length} failed assertions`);
  }
  const killed = results.filter((result) => result.status === 'killed').length;
  const evidence = {
    command: 'node jobs/P01-quiz-rush/mutate.mjs',
    testCommand: `node node_modules/vitest/vitest.mjs run ${ruleTest} --maxWorkers=1 --reporter=json --outputFile=<temporary report>`,
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
    join(job, 'mutation-results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
    'utf8',
  );
  console.log(`${killed}/${mutants.length} meaningful mutations detected`);
  if (killed < 19) process.exitCode = 1;
} finally {
  for (const [path, bytes] of originals) writeFileSync(path, bytes);
  for (const [path, bytes] of originals) {
    if (hash(readFileSync(path)) !== hash(bytes))
      throw new Error(`Source restoration failed: ${path}`);
  }
  try {
    unlinkSync(reportPath);
  } catch {
    /* Report was removed after each run. */
  }
  rmdirSync(temp);
}
