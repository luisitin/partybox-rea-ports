// Run from the repo root: node jobs/P04-draw-and-guess/tools/mutate.mjs
// Each behavioral defect is applied alone. Tests must execute assertions (compile failures
// do not count), and original source bytes are restored in both per-trial and outer finally.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const prefix = 'games/draw-and-guess/server/';
const trials = [
  [
    'M01',
    'remove guess base points',
    'scoring.ts',
    'return 100 + Math.round(400',
    'return 0 + Math.round(400',
  ],
  ['M02', 'halve speed bonus', 'scoring.ts', 'Math.round(400 *', 'Math.round(200 *'],
  [
    'M03',
    'allow elapsed time to exceed scoring clamp',
    'scoring.ts',
    'Math.min(1, Math.max(0, elapsed / duration))',
    'Math.min(2, Math.max(0, elapsed / duration))',
  ],
  ['M04', 'double drawer reward', 'scoring.ts', 'Math.round(300 *', 'Math.round(600 *'],
  [
    'M05',
    'include artist in eligible denominator',
    'scoring.ts',
    'solved / eligible',
    'solved / (eligible + 1)',
  ],
  [
    'M06',
    'choice timer never exits',
    'phases/choose.ts',
    'return next(state, event.now);',
    'return state;',
  ],
  [
    'M07',
    'let guessers choose the secret',
    'phases/choose.ts',
    'event.playerId !== state.drawerId ||',
    'false ||',
  ],
  [
    'M08',
    'drawing cap no longer exits',
    'phases/draw.ts',
    'if (now >= state.endsAt || allSolved(state))',
    'if (allSolved(state))',
  ],
  [
    'M09',
    'delay the first hint to half time',
    'phases/draw.ts',
    'return nextStep(opened, now + (endsAt - now) / 3);',
    'return nextStep(opened, now + (endsAt - now) / 2);',
  ],
  [
    'M10',
    'reveal timer never rotates artists',
    'phases/reveal.ts',
    'next(state, event.now)',
    'state',
  ],
  [
    'M11',
    'reveal answer publicly during play',
    'index.ts',
    "const revealed = state.phase.id === 'reveal' || state.phase.id === 'done';",
    'const revealed = true;',
  ],
  [
    'M12',
    'leak artist secret to every phone',
    'index.ts',
    "secret: isDrawer && state.phase.id === 'draw'",
    "secret: state.phase.id === 'draw'",
  ],
  [
    'M13',
    'leak all choices to every phone',
    'index.ts',
    "choices: isDrawer && state.phase.id === 'choose'",
    "choices: state.phase.id === 'choose'",
  ],
  [
    'M14',
    'let guessers use artist controls',
    'phases/draw.ts',
    'if (playerId === state.drawerId)',
    'if (true)',
  ],
  [
    'M15',
    'accept duplicate sequence numbers',
    'phases/draw.ts',
    'input.stroke.seq <= state.lastSeq ||',
    'input.stroke.seq < state.lastSeq ||',
  ],
  [
    'M16',
    'allow points past the canvas cap',
    'phases/draw.ts',
    'points + input.stroke.points.length > MAX_POINTS',
    'points + input.stroke.points.length > MAX_POINTS + 32',
  ],
  [
    'M17',
    'allow an extra stroke chunk',
    'phases/draw.ts',
    'state.strokes.length >= MAX_STROKES ||',
    'state.strokes.length > MAX_STROKES ||',
  ],
  [
    'M18',
    'undo only the last packet instead of the gesture',
    'phases/draw.ts',
    'state.strokes.filter((stroke) => stroke.id !== id)',
    'state.strokes.slice(0, -1)',
  ],
  [
    'M19',
    'do not shift the drawing cap after pause',
    'index.ts',
    'endsAt: state.endsAt + ms,',
    'endsAt: state.endsAt,',
  ],
  [
    'M20',
    'end on the first solver instead of all solvers',
    'phases/draw.ts',
    'eligibleIds(state).every((id)',
    'eligibleIds(state).some((id)',
  ],
].map(([id, description, file, before, after]) => ({
  id,
  description,
  file: prefix + file,
  before,
  after,
}));
const tests = ['game', 'scoring', 'strokes', 'presence'].map(
  (name) => `games/draw-and-guess/__tests__/${name}.test.ts`,
);
const scratch = mkdtempSync(resolve(tmpdir(), 'p04-mutations-'));
const originals = new Map(
  trials.map((trial) => [trial.file, readFileSync(resolve(repo, trial.file))]),
);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const command = [
  'vitest',
  'run',
  ...tests,
  '--maxWorkers=1',
  '--reporter=json',
  `--outputFile=${resolve(scratch, 'vitest.json')}`,
];

function run() {
  const path = resolve(scratch, 'vitest.json');
  rmSync(path, { force: true });
  // Invoke the installed CLI with Node: Windows .cmd wrappers require a shell and
  // recent Node warns about shell argument concatenation even for fixed arguments.
  const processResult = spawnSync(
    process.execPath,
    [resolve(repo, 'node_modules/vitest/vitest.mjs'), ...command.slice(1)],
    {
      cwd: repo,
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  let report;
  try {
    report = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(
      `Vitest did not produce a report: ${processResult.stderr}\n${processResult.stdout}`,
    );
  }
  return { processResult, report };
}

const results = {
  command: `node node_modules/vitest/vitest.mjs ${command.slice(1, -1).join(' ')} --outputFile=<temporary JSON report>`,
  baseline: null,
  mutations: [],
  restored: false,
  finalBaseline: null,
};
try {
  const baseline = run();
  results.baseline = {
    exitCode: baseline.processResult.status,
    total: baseline.report.numTotalTests,
    passed: baseline.report.numPassedTests,
    failed: baseline.report.numFailedTests,
  };
  if (
    baseline.processResult.status !== 0 ||
    baseline.report.numFailedTests !== 0 ||
    baseline.report.numTotalTests < 30
  )
    throw new Error('Mutation baseline is not green');
  console.log(`Baseline: ${baseline.report.numPassedTests} passed.`);
  for (const trial of trials) {
    const original = originals.get(trial.file);
    const source = original.toString('utf8');
    if (source.split(trial.before).length !== 2)
      throw new Error(
        `${trial.id}: expected exactly one source pattern ${JSON.stringify(trial.before)}`,
      );
    let measured;
    try {
      writeFileSync(resolve(repo, trial.file), source.replace(trial.before, trial.after), 'utf8');
      measured = run();
    } finally {
      writeFileSync(resolve(repo, trial.file), original);
    }
    const { report, processResult } = measured;
    const assertions = report.testResults.flatMap((file) => file.assertionResults ?? []);
    const failed = assertions.filter((test) => test.status === 'failed');
    const caught =
      processResult.status === 1 &&
      report.numTotalTests === baseline.report.numTotalTests &&
      failed.length > 0;
    const failureTests = failed.map((test) => ({
      test: test.fullName,
      reason: (test.failureMessages ?? []).map((message) =>
        message.split('\n').slice(0, 3).join('\n'),
      ),
    }));
    results.mutations.push({
      ...trial,
      originalSha256: sha(original),
      mutatedSha256: sha(Buffer.from(source.replace(trial.before, trial.after))),
      exitCode: processResult.status,
      totalTests: report.numTotalTests,
      failedTests: report.numFailedTests,
      caught,
      failureTests,
    });
    console.log(
      `${trial.id}: ${caught ? 'CAUGHT' : 'SURVIVED'} (${failed.length} assertion failures) — ${trial.description}`,
    );
    if (
      report.numTotalTests !== baseline.report.numTotalTests ||
      (processResult.status !== 0 && failed.length === 0)
    )
      throw new Error(
        `${trial.id}: test execution error; cannot count a compilation/tool failure as a kill`,
      );
  }
} finally {
  for (const [file, bytes] of originals) writeFileSync(resolve(repo, file), bytes);
  results.restored = [...originals].every(
    ([file, bytes]) => sha(readFileSync(resolve(repo, file))) === sha(bytes),
  );
  const final = run();
  results.finalBaseline = {
    exitCode: final.processResult.status,
    total: final.report.numTotalTests,
    passed: final.report.numPassedTests,
    failed: final.report.numFailedTests,
  };
  writeFileSync(
    resolve(repo, 'jobs/P04-draw-and-guess/tools/mutation-results.json'),
    JSON.stringify(results, null, 2) + '\n',
    'utf8',
  );
  rmSync(scratch, { recursive: true, force: true });
}
const catches = results.mutations.filter((trial) => trial.caught).length;
console.log(
  `${catches}/${trials.length} caught; restored=${results.restored}; final=${results.finalBaseline.passed} passed.`,
);
if (catches < 19 || !results.restored || results.finalBaseline.exitCode !== 0) process.exitCode = 1;
