// Each mutant starts from the same source snapshot and is restored even if Vitest throws.
// The focused command exercises only this game's rules tests, sequentially, with one worker.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

interface Mutant {
  name: string;
  file: string;
  before: string | RegExp;
  after: string;
}
const prefix = 'games/2048/server/';
const mutants: Mutant[] = [
  {
    name: 'merge unequal tiles',
    file: 'board.ts',
    before: 'a === values[i + 1]',
    after: 'a !== values[i + 1]',
  },
  {
    name: 'wrong merged tile value',
    file: 'board.ts',
    before: 'out.push(a * 2)',
    after: 'out.push(a * 4)',
  },
  { name: 'half merge points', file: 'board.ts', before: 'gain += a * 2', after: 'gain += a' },
  { name: 'reuse the second tile', file: 'board.ts', before: 'i++;', after: 'i += 0;' },
  {
    name: 'reverse right input',
    file: 'board.ts',
    before: "if (dir === 'right') return lane * 4 + 3 - step;",
    after: "if (dir === 'right') return lane * 4 + step;",
  },
  {
    name: 'ignore vertical merges',
    file: 'board.ts',
    before: 'if (i < 12 && value === board[i + 4]) return true;',
    after: 'if (false) return true;',
  },
  {
    name: 'no empty-cell mobility',
    file: 'board.ts',
    before: 'if (value === 0) return true;',
    after: 'if (value === 0) return false;',
  },
  { name: 'wrong spawn normalization', file: 'board.ts', before: '/ 65536', after: '/ 65535' },
  {
    name: 'always spawn a four',
    file: 'board.ts',
    before: 'next[cell] = draw.value;',
    after: 'next[cell] = 4;',
  },
  {
    name: 'no-op spends a spawn',
    file: 'phases/play.ts',
    before: 'if (!moved.changed) return state;',
    after: 'if (false) return state;',
  },
  {
    name: 'duplicate input accepted',
    file: 'phases/play.ts',
    before: 'event.input.move !== racer.moves',
    after: 'false',
  },
  {
    name: 'no anti-flood interval',
    file: 'phases/play.ts',
    before: 'event.now - racer.lastAt < MOVE_MS',
    after: 'false',
  },
  {
    name: 'deadline accepts final move',
    file: 'phases/play.ts',
    before: /if \(state\.phase\.deadline !== null && event\.now >= state\.phase\.deadline\)/,
    after: 'if (state.phase.deadline !== null && event.now > state.phase.deadline)',
  },
  {
    name: 'target never ends race',
    file: 'phases/play.ts',
    before: 'if (won) return next',
    after: 'if (false) return next',
  },
  {
    name: 'blocked boards never end race',
    file: 'phases/play.ts',
    before: 'return raceFinished(fresh)',
    after: 'return false',
  },
  {
    name: 'wrong draw index',
    file: 'phases/play.ts',
    before: 'state.spawns[racer.moves + 2]',
    after: 'state.spawns[racer.moves + 3]',
  },
  {
    name: 'score ignores earlier merges',
    file: 'phases/play.ts',
    before: 'score: racer.score + moved.gain',
    after: 'score: moved.gain',
  },
  {
    name: 'finished loses to higher score',
    file: 'scoring.ts',
    before: 'return finished || b.score - a.score;',
    after: 'return b.score - a.score;',
  },
  {
    name: 'reveal timer never exits',
    file: 'phases/reveal.ts',
    before: '? next(state, event.now)',
    after: '? state',
  },
  {
    name: 'future draws leak to public views',
    file: 'index.ts',
    before: '...raceView(state)',
    after: '...raceView(state), spawns: state.spawns',
  },
];
const originals = new Map(
  mutants.map(({ file }) => [file, readFileSync(resolve(prefix, file), 'utf8')]),
);
const results: {
  name: string;
  file: string;
  caught: boolean;
  exitCode: number | null;
  failedTests: string[];
  failedAssertions: { name: string; messages: string[] }[];
  passedTests: number;
  failedTestCount: number;
  elapsedMs: number;
  error: string | null;
}[] = [];
const startedAt = new Date().toISOString();
const began = performance.now();
const sourceHashes = Object.fromEntries(
  [...originals].map(([file, source]) => [
    prefix + file,
    createHash('sha256').update(source).digest('hex'),
  ]),
);
const reportDir = mkdtempSync(resolve(tmpdir(), 'r1-local-2048-mutations-'));
const reportFile = resolve(reportDir, 'vitest.json');
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = [
  'vitest',
  'run',
  'games/2048/__tests__/board.test.ts',
  'games/2048/__tests__/game.test.ts',
  '--maxWorkers=1',
  '--pool=threads',
  '--reporter=json',
  `--outputFile=${reportFile}`,
];
const restoredArgs = [
  'vitest',
  'run',
  'games/2048',
  '--maxWorkers=1',
  '--pool=threads',
  '--reporter=json',
  `--outputFile=${reportFile}`,
];
const testSources = Object.fromEntries(
  args
    .filter((path) => path.endsWith('.test.ts'))
    .map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]),
);

interface TestReport {
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: {
    assertionResults: { fullName: string; status: string; failureMessages: string[] }[];
  }[];
}
function baselineSources(): Record<string, string> {
  const collect = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? collect(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
    );
  return Object.fromEntries(
    collect('games/2048')
      .filter((path) => path.startsWith('games/2048/client/') || /\.test\.tsx?$/.test(path))
      .sort()
      .map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]),
  );
}

function runTests(testArgs = args) {
  const started = performance.now();
  const sources = testArgs === restoredArgs ? baselineSources() : null;
  rmSync(reportFile, { force: true });
  const run = spawnSync(command, testArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
  let report: TestReport | null = null;
  try {
    report = JSON.parse(readFileSync(reportFile, 'utf8')) as TestReport;
  } catch {
    /* Failed loading is not a caught rule bug. */
  }
  return {
    ...run,
    report,
    elapsedMs: Math.round(performance.now() - started),
    finishedAt: new Date().toISOString(),
    sources,
    sourcesStable: !sources || JSON.stringify(sources) === JSON.stringify(baselineSources()),
  };
}
type TestRun = ReturnType<typeof runTests>;
function passedRun(run: TestRun | null): boolean {
  return (
    run?.status === 0 &&
    !!run.report &&
    run.report.numFailedTests === 0 &&
    run.report.numPassedTests > 0 &&
    run.sourcesStable
  );
}
function evidence(run: TestRun) {
  return {
    exitCode: run.status,
    passedTests: run.report?.numPassedTests,
    passedSuites: run.report?.numPassedTestSuites,
    files: run.report?.testResults.length,
    failedTests: run.report?.numFailedTests,
    failedAssertions: (run.report?.testResults ?? []).flatMap((suite) =>
      suite.assertionResults
        .filter((test) => test.status === 'failed')
        .map((test) => ({
          name: test.fullName,
          messages: test.failureMessages,
        })),
    ),
    error: run.error?.message ?? null,
    elapsedMs: run.elapsedMs,
    finishedAt: run.finishedAt,
    sources: run.sources,
    sourcesStable: run.sourcesStable,
  };
}
function cleanupReport(): void {
  if (!resolve(reportDir).startsWith(resolve(tmpdir(), 'r1-local-2048-mutations-')))
    throw new Error('Unexpected mutation report directory');
  rmSync(reportDir, { recursive: true, force: true });
}
let baseline: ReturnType<typeof runTests> | null = null;
let restoredBaseline: ReturnType<typeof runTests> | null = null;
function checkpoint(incomplete = true, restored = false): void {
  writeFileSync(
    resolve('jobs/P09-2048-race/mutations.json'),
    `${JSON.stringify(
      {
        startedAt,
        finishedAt: incomplete ? null : new Date().toISOString(),
        command: [command, ...args].join(' '),
        restoredCommand: [command, ...restoredArgs].join(' '),
        sourceHashes,
        testSources,
        baseline: baseline ? evidence(baseline) : null,
        restoredBaseline: restoredBaseline ? evidence(restoredBaseline) : null,
        expectedMutants: mutants.length,
        completedMutants: results.length,
        caughtMutants: results.filter((result) => result.caught).length,
        incomplete,
        restored,
        passed: !incomplete && restored && results.filter((result) => result.caught).length >= 19,
        elapsedMs: Math.round(performance.now() - began),
        results,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
if (process.env['MERGE_MUTATION_BASELINE_ONLY'] === '1') {
  // A test-only repair may refresh the restored baseline without replanting the
  // already-proven mutations. Require identical affected source and rules tests.
  const output = resolve('jobs/P09-2048-race/mutations.json');
  const previous = JSON.parse(readFileSync(output, 'utf8')) as {
    sourceHashes: Record<string, string>;
    testSources: Record<string, string>;
    completedMutants: number;
    caughtMutants: number;
    results: { caught: boolean }[];
    restoredBaseline: object | null;
    baselineAttempts?: object[];
  };
  if (
    previous.completedMutants !== mutants.length ||
    previous.results.length !== mutants.length ||
    previous.results.filter((result) => result.caught).length < 19 ||
    JSON.stringify(previous.sourceHashes) !== JSON.stringify(sourceHashes) ||
    JSON.stringify(previous.testSources) !== JSON.stringify(testSources)
  ) {
    cleanupReport();
    throw new Error('Mutation source/rules-test evidence changed; rerun all mutations');
  }
  try {
    const run = runTests(restoredArgs);
    const restored = [...originals].every(
      ([file, source]) => readFileSync(resolve(prefix, file), 'utf8') === source,
    );
    const baselineEvidence = evidence(run);
    const passed = passedRun(run) && restored;
    writeFileSync(
      output,
      `${JSON.stringify(
        {
          ...previous,
          restoredCommand: [command, ...restoredArgs].join(' '),
          restoredBaseline: baselineEvidence,
          baselineAttempts: [
            ...(previous.baselineAttempts ??
              (previous.restoredBaseline ? [previous.restoredBaseline] : [])),
            baselineEvidence,
          ],
          finishedAt: passed ? run.finishedAt : null,
          baselineOnlyStartedAt: startedAt,
          incomplete: !passed,
          restored,
          passed,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    console.log(JSON.stringify(baselineEvidence));
    if (!passed) process.exitCode = 1;
  } finally {
    cleanupReport();
  }
} else {
  checkpoint();
  try {
    baseline = runTests();
    if (!passedRun(baseline)) {
      console.error(baseline.stdout, baseline.stderr);
      throw new Error('Baseline must pass before mutation testing');
    }
    for (const mutant of mutants) {
      const original = originals.get(mutant.file)!;
      if (
        typeof mutant.before === 'string'
          ? !original.includes(mutant.before)
          : !mutant.before.test(original)
      )
        throw new Error(`Missing mutation target: ${mutant.name}`);
      try {
        writeFileSync(
          resolve(prefix, mutant.file),
          original.replace(mutant.before, mutant.after),
          'utf8',
        );
        const run = runTests();
        // Syntax/type/import errors do not count as detected rule violations.
        const failedTests = (run.report?.testResults ?? []).flatMap((suite) =>
          suite.assertionResults
            .filter((test) => test.status === 'failed')
            .map((test) => test.fullName),
        );
        const caught = run.status !== 0 && failedTests.length > 0;
        const result = {
          name: mutant.name,
          file: mutant.file,
          caught,
          exitCode: run.status,
          failedTests,
          failedAssertions: evidence(run).failedAssertions,
          passedTests: run.report?.numPassedTests ?? 0,
          failedTestCount: run.report?.numFailedTests ?? 0,
          elapsedMs: run.elapsedMs,
          error: run.error?.message ?? null,
        };
        results.push(result);
        console.log(
          JSON.stringify({
            name: result.name,
            caught: result.caught,
            failedTestCount: result.failedTestCount,
            elapsedMs: result.elapsedMs,
            error: result.error,
          }),
        );
      } finally {
        writeFileSync(resolve(prefix, mutant.file), original, 'utf8');
        checkpoint();
      }
    }
    restoredBaseline = runTests(restoredArgs);
    if (!passedRun(restoredBaseline))
      throw new Error('Restored source must pass after mutation testing');
  } finally {
    for (const [file, source] of originals) writeFileSync(resolve(prefix, file), source, 'utf8');
    const restored = [...originals].every(
      ([file, source]) => readFileSync(resolve(prefix, file), 'utf8') === source,
    );
    checkpoint(results.length !== mutants.length || !passedRun(restoredBaseline), restored);
    cleanupReport();
    if (!restored) throw new Error('Mutation source restoration failed');
  }
  const caught = results.filter((result) => result.caught).length;
  console.log(`${caught}/${mutants.length} mutants caught`);
  if (caught < 19) process.exitCode = 1;
}
