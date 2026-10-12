// Source-bound behavioral mutations, one own-game thread worker, restored even on failure.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  behaviorSources,
  dependencySources,
  digest,
  gameSources,
  hashes,
  root,
  runtimeSources,
  sameSources,
  snapshot,
  sourceChanges,
} from './provenance.mjs';

const jobDir = dirname(fileURLToPath(import.meta.url));
const job = 'jobs/P05-blob-arena';
const server = resolve(root, 'games/agar-io/server');
const finalFile = resolve(jobDir, 'mutations.json');
const simFile = resolve(jobDir, 'sim-report.json');
const focusedFiles = [
  'games/agar-io/__tests__/mechanics.test.ts',
  'games/agar-io/__tests__/game.test.ts',
  'games/agar-io/__tests__/regressions.test.ts',
];
const baselineOnly = process.env.PB_MUTATION_BASELINE_ONLY === '1';
const deferBaseline = process.env.PB_MUTATION_DEFER_BASELINE === '1';
const fullRuns = Number(process.env.PB_SIM_RUNS ?? 1000);
if (!Number.isInteger(fullRuns) || fullRuns < 1) throw new Error('Invalid PB_SIM_RUNS');

const mutations = [
  [
    'M01',
    'Score rounds up instead of down',
    'scoring.ts',
    'Math.floor(totalMass(world, id))',
    'Math.ceil(totalMass(world, id))',
  ],
  [
    'M02',
    'Score counts only the largest split part',
    'scoring.ts',
    'Math.floor(totalMass(world, id))',
    'Math.floor(Math.max(0, ...world.cells.filter(c => c.owner === id).map(c => c.mass)))',
  ],
  [
    'M03',
    'New round replaces previously banked points',
    'phases/score.ts',
    'n + (lastPoints[id] ?? 0)',
    '(lastPoints[id] ?? 0)',
  ],
  ['M04', 'Match exits after two rounds', 'index.ts', 'state.round >= 3', 'state.round >= 2'],
  [
    'M05',
    'Timer waits beyond the horn before entering score',
    'phases/play.ts',
    'return now >= s.endsAt',
    'return now >= s.endsAt + 1000',
  ],
  [
    'M06',
    'Horn drops the final physics step',
    'phases/play.ts',
    'Math.min(ROUND_MS, Math.max(0, now - state.began))',
    'Math.min(ROUND_MS - 100, Math.max(0, now - state.began))',
  ],
  [
    'M07',
    'Predator needs only a 1.15 mass ratio',
    'types.ts',
    'export const EAT_RATIO = 1.25;',
    'export const EAT_RATIO = 1.15;',
  ],
  [
    'M08',
    'Grazing edges swallow prey without deep overlap',
    'collisions.ts',
    'if (gap >= radius(predator.mass) - radius(victim.mass) * 0.35) continue;',
    'if (gap >= radius(predator.mass) + radius(victim.mass)) continue;',
  ],
  [
    'M09',
    'A spawn shield does not protect its victim',
    'collisions.ts',
    'if (time < victim.shieldUntil) continue;',
    'if (false) continue;',
  ],
  [
    'M10',
    'Splitting loses a third of the mass',
    'world.ts',
    'const half = c.mass / 2;',
    'const half = c.mass / 3;',
  ],
  [
    'M11',
    'Splitting has no cooldown',
    'types.ts',
    'export const SPLIT_COOLDOWN_MS = 1000;',
    'export const SPLIT_COOLDOWN_MS = 0;',
  ],
  [
    'M12',
    'Splitting is allowed at starting mass',
    'types.ts',
    'export const SPLIT_MIN = 48;',
    'export const SPLIT_MIN = 24;',
  ],
  [
    'M13',
    'The split cap allows eight cells',
    'types.ts',
    'export const MAX_CELLS = 4;',
    'export const MAX_CELLS = 8;',
  ],
  [
    'M14',
    'Siblings unlock merging after one second',
    'types.ts',
    'export const MERGE_MS = 8000;',
    'export const MERGE_MS = 1000;',
  ],
  [
    'M15',
    'A swallowed seat respawns in half the specified time',
    'world.ts',
    'respawns[id] = time + RESPAWN_MS;',
    'respawns[id] = time + RESPAWN_MS / 2;',
  ],
  [
    'M16',
    'Respawns lose their two-second shield',
    'spawn.ts',
    'shieldUntil: world.time + shield,',
    'shieldUntil: world.time,',
  ],
  [
    'M17',
    'A pellet awards double mass',
    'world.ts',
    'eater.mass += PELLET_MASS;',
    'eater.mass += PELLET_MASS * 2;',
  ],
  [
    'M18',
    'An eaten pellet stays available at the same spot',
    'world.ts',
    'return fresh;',
    'return p;',
  ],
  [
    'M19',
    'Resume fails to extend the round end clock',
    'index.ts',
    'endsAt: state.endsAt + ms',
    'endsAt: state.endsAt',
  ],
  [
    'M20',
    'TV view exposes the future random sequence',
    'index.ts',
    "timerMode: 'quiet',",
    "timerMode: 'quiet',\n    ...{ rng: state.rng },",
  ],
].map(([id, name, file, from, to]) => ({ id, name, file, from, to }));

const mechanics = focusedFiles[0];
const match = focusedFiles[1];
const regressions = focusedFiles[2];
const testsById = {
  M01: [match, mechanics],
  M02: [mechanics],
  M03: [match],
  M04: [match],
  M05: [match],
  M06: [match],
  M07: [mechanics],
  M08: [mechanics],
  M09: [mechanics],
  M10: [mechanics, regressions],
  M11: [match],
  M12: [match, mechanics],
  M13: [match, mechanics],
  M14: [mechanics],
  M15: [mechanics],
  M16: [mechanics],
  M17: [match, mechanics],
  M18: [mechanics],
  M19: [match],
  M20: [match],
};
const sourceHashes = behaviorSources();
const dependencyHashes = dependencySources();
const testSources = hashes(focusedFiles);
const originalGameSources = runtimeSources();
const originals = new Map(mutations.map(({ file }) => [file, readFileSync(resolve(server, file))]));
const startedAt = new Date().toISOString();
const began = performance.now();
const reportDir = mkdtempSync(resolve(tmpdir(), 'r1-local-P05-mutations-'));
const resultFile = resolve(reportDir, 'vitest.json');
const outcomes = [];
let baseline = null;
let restoredBaseline = null;
let error = null;
let finishedAt = null;

function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function argsFor(testFiles, full = false) {
  return [
    'vitest',
    'run',
    ...testFiles,
    '--maxWorkers=1',
    '--pool=threads',
    '--reporter=json',
    '--outputFile=' + resultFile,
    ...(full ? ['--disableConsoleIntercept'] : []),
  ];
}
function commandFor(args) {
  return 'pnpm.cmd ' + args.map((arg) => (/\s/.test(arg) ? '"' + arg + '"' : arg)).join(' ');
}
async function runTests(testFiles = focusedFiles, full = false) {
  const runStartedAt = new Date().toISOString();
  const runBegan = performance.now();
  const sources = snapshot(testFiles, full);
  const args = argsFor(testFiles, full);
  rmSync(resultFile, { force: true });
  const reports = [];
  let stdout = '';
  let stderr = '';
  let pendingLine = '';
  let runError = null;
  let outputBytes = 0;
  const windows = process.platform === 'win32';
  const child = spawn(
    windows ? 'cmd.exe' : 'pnpm',
    windows ? ['/d', '/s', '/c', commandFor(args)] : args,
    {
      cwd: root,
      windowsHide: true,
      detached: !windows,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        ...(full ? { PB_RECORD_VERIFY: '1', PB_SIM_RUNS: String(fullRuns) } : {}),
      },
    },
  );
  function stopOwnedChild(reason) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    runError ??= reason;
    if (windows && child.pid) {
      // The direct child is this runner's command and owns its one Vitest worker.
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        timeout: 15_000,
        encoding: 'utf8',
      });
    } else if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }
  }
  function consumeLine(line) {
    try {
      const report = JSON.parse(line.trim());
      if (
        Number.isInteger(report.players) &&
        Number.isInteger(report.games) &&
        report.gamesBySkill &&
        Number.isFinite(report.medianRoundMs)
      ) {
        reports.push(report);
        if (full && fullRuns === 1000) {
          writeJson(simFile, {
            status: 'running',
            incomplete: true,
            startedAt: runStartedAt,
            finishedAt: null,
            expectedGames: 7000,
            games: reports.reduce((sum, group) => sum + group.games, 0),
            reports,
            sources: { ...sourceHashes, ...dependencyHashes },
          });
          console.log(
            JSON.stringify({
              stage: 'full-simulation',
              players: report.players,
              completedGames: report.games,
              maxGameMs: report.maxGameMs,
              medianRoundMs: report.medianRoundMs,
            }),
          );
        }
      }
    } catch {
      /* Other own-game output is not simulation evidence. */
    }
  }
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk) => {
    outputBytes += Buffer.byteLength(chunk);
    stdout += chunk.toString('utf8');
    pendingLine += chunk.toString('utf8');
    const lines = pendingLine.split(/\r?\n/);
    pendingLine = lines.pop();
    lines.forEach(consumeLine);
    if (outputBytes > 20 * 1024 * 1024) stopOwnedChild('Own-game output exceeded 20 MB');
  });
  child.stderr?.on('data', (chunk) => {
    outputBytes += Buffer.byteLength(chunk);
    stderr += chunk.toString('utf8');
    if (outputBytes > 20 * 1024 * 1024) stopOwnedChild('Own-game output exceeded 20 MB');
  });
  const timer = setTimeout(
    () => stopOwnedChild('Own-game subprocess timed out'),
    full ? 30 * 60_000 : 180_000,
  );
  let exitCode;
  try {
    exitCode = await new Promise((accept) => {
      child.on('error', (failure) => {
        runError = failure.message;
      });
      child.on('close', (code) => accept(code));
    });
  } finally {
    clearTimeout(timer);
  }
  if (pendingLine.trim()) consumeLine(pendingLine);
  let json = null;
  let reportError = null;
  try {
    json = JSON.parse(readFileSync(resultFile, 'utf8'));
  } catch (failure) {
    reportError = failure.message;
  }
  const failedTests = (json?.testResults ?? []).flatMap((suite) =>
    (suite.assertionResults ?? [])
      .filter((test) => test.status === 'failed')
      .map((test) => ({ name: test.fullName, failures: test.failureMessages ?? [] })),
  );
  const brokenSuites = (json?.testResults ?? [])
    .filter(
      (suite) =>
        suite.status === 'failed' &&
        !(suite.assertionResults ?? []).some((test) => test.status === 'failed'),
    )
    .map((suite) => ({ name: suite.name, message: suite.message }));
  const invalidFailures = failedTests.filter((test) =>
    test.failures.some((message) =>
      /(?:Test|Hook) timed out|TimeoutError|Transform failed|Failed to resolve import|Cannot find module|Failed to load url|SyntaxError:/.test(
        message,
      ),
    ),
  );
  const semanticFailures = failedTests.filter((test) =>
    test.failures.some((message) => message.includes('AssertionError:')),
  );
  const after = snapshot(testFiles, full);
  const changes = sourceChanges(sources, after);
  return {
    exitCode,
    success:
      exitCode === 0 &&
      json?.success === true &&
      json.numPassedTests > 0 &&
      json.numFailedTests === 0 &&
      brokenSuites.length === 0 &&
      runError === null &&
      changes.length === 0,
    failedTests,
    brokenSuites,
    invalidFailures,
    semanticFailures,
    error: runError,
    reportError,
    passedTests: json?.numPassedTests ?? 0,
    failedTestCount: json?.numFailedTests ?? 0,
    totalTests: json?.numTotalTests ?? 0,
    files: json?.testResults?.length ?? 0,
    startedAt: runStartedAt,
    finishedAt: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - runBegan),
    command: windows ? commandFor(args) : ['pnpm', ...args].join(' '),
    sources,
    sourceBefore: sources,
    sourceAfter: after,
    sourcesStable: changes.length === 0,
    sourceChanges: changes,
    simulationRunsPerCount: full ? fullRuns : null,
    simulationReports: reports,
    simulationTests: (json?.testResults ?? []).flatMap((suite) =>
      (suite.assertionResults ?? [])
        .filter((test) => / players: 1,000 games cycle/.test(test.fullName))
        .map((test) => ({ name: test.fullName, status: test.status, durationMs: test.duration })),
    ),
    outputTail: (stdout + '\n' + stderr).slice(-4000),
  };
}
function simulationSources() {
  return { ...behaviorSources(), ...dependencySources() };
}
function completeReports(reports) {
  if (!Array.isArray(reports) || reports.length !== 7) return false;
  const manifest = JSON.parse(readFileSync(resolve(root, 'games/agar-io/manifest.json'), 'utf8'));
  const limitMs = manifest.estimatedMinutes * 2 * 60_000;
  return [2, 3, 4, 5, 6, 7, 8].every((count) => {
    const matches = reports.filter((report) => report.players === count);
    if (matches.length !== 1) return false;
    const report = matches[0];
    return (
      report.games === 1000 &&
      ['easy', 'normal', 'sharp'].every(
        (skill) => Number.isInteger(report.gamesBySkill?.[skill]) && report.gamesBySkill[skill] > 0,
      ) &&
      Object.values(report.gamesBySkill).reduce((sum, value) => sum + value, 0) === 1000 &&
      report.medianRoundMs === 90_000 &&
      Number.isFinite(report.medianGameMs) &&
      report.medianGameMs <= limitMs &&
      Number.isFinite(report.maxGameMs) &&
      report.maxGameMs <= limitMs &&
      report.maxEvents <= 5000 &&
      Number.isFinite(report.minScore) &&
      report.minScore >= 0 &&
      Number.isFinite(report.maxScore)
    );
  });
}
function freshSimulationMatches() {
  try {
    const prior = JSON.parse(readFileSync(simFile, 'utf8'));
    return (
      prior.status === 'passed' &&
      !prior.incomplete &&
      prior.games === 7000 &&
      completeReports(prior.reports) &&
      sameSources(prior.sources, simulationSources())
    );
  } catch {
    return false;
  }
}
function recordSimulation(run) {
  const reports = run.simulationReports;
  const manifest = JSON.parse(readFileSync(resolve(root, 'games/agar-io/manifest.json'), 'utf8'));
  const valid =
    completeReports(reports) &&
    run.simulationTests.length === 7 &&
    run.simulationTests.every((test) => test.status === 'passed') &&
    run.sourcesStable &&
    !run.error &&
    sameSources({ ...sourceHashes, ...dependencyHashes }, simulationSources());
  writeJson(simFile, {
    runId: 'r1-local',
    status: valid ? 'passed' : 'incomplete',
    incomplete: !valid,
    command: run.command,
    startedAt: run.startedAt,
    finishedAt: valid ? run.finishedAt : null,
    elapsedMs: run.simulationTests.reduce((sum, test) => sum + (test.durationMs ?? 0), 0),
    sourceScope: 'All server/content/manifest bytes plus local SDK/shared/dependency configuration',
    sources: { ...sourceHashes, ...dependencyHashes },
    runsPerCount: 1000,
    seedRange: [1, 1000],
    counts: [2, 3, 4, 5, 6, 7, 8],
    expectedGames: 7000,
    games: reports.reduce((sum, report) => sum + report.games, 0),
    maxAllowedGameMs: manifest.estimatedMinutes * 2 * 60_000,
    maxAllowedEvents: 5000,
    reports,
    totalEvents: reports.reduce((sum, report) => sum + report.totalEvents, 0),
    maxGameMs: reports.length ? Math.max(...reports.map((report) => report.maxGameMs)) : null,
  });
  return valid;
}
function restoreSources() {
  const failures = [];
  for (const [file, original] of originals) {
    try {
      writeFileSync(resolve(server, file), original);
      if (!readFileSync(resolve(server, file)).equals(original))
        throw new Error('Restored bytes differ');
    } catch (failure) {
      failures.push(file + ': ' + failure.message);
    }
  }
  if (failures.length) throw new Error('Source restoration failed: ' + failures.join('; '));
}
function restored() {
  return (
    [...originals].every(([file, original]) =>
      readFileSync(resolve(server, file)).equals(original),
    ) &&
    sameSources(originalGameSources, runtimeSources()) &&
    sameSources(dependencyHashes, dependencySources())
  );
}
function runtimeHashPart(sourceMap) {
  return Object.fromEntries(
    Object.entries(sourceMap ?? {}).filter(([path]) => path.startsWith('games/agar-io/')),
  );
}
function checkpoint(stage, complete = false) {
  const sourceRestored = restored();
  const killed = outcomes.filter((item) => item.killed).length;
  const passed = complete && killed >= 19 && sourceRestored && restoredBaseline?.success;
  writeJson(finalFile, {
    runId: 'r1-local',
    command: commandFor(argsFor(focusedFiles)),
    restoredCommand: commandFor(argsFor(['games/agar-io'], true)),
    startedAt,
    finishedAt: complete ? finishedAt : null,
    elapsedMs: Math.round(performance.now() - began),
    sourceHashes,
    dependencyHashes,
    testSources,
    baseline,
    restoredBaseline,
    mutations: outcomes,
    killed,
    total: mutations.length,
    expectedMutants: mutations.length,
    completedMutants: outcomes.length,
    sourceFiles: Object.keys(originalGameSources).length,
    sourceFilesMeaning: 'Original mutation-time runtime count, not final baseline runtime count',
    mutationRuntimeFileCount: Object.keys(originalGameSources).length,
    recordedMutationRuntimeHashes: originalGameSources,
    finalBaselineRuntimeHashes: restoredBaseline
      ? runtimeHashPart(restoredBaseline.sourceBefore)
      : null,
    finalBaselineRuntimeHashesAfter: restoredBaseline
      ? runtimeHashPart(restoredBaseline.sourceAfter)
      : null,
    sourceScope:
      'Server/content/manifest and focused rule-test mutation evidence plus SDK/shared/dependency configuration',
    baselineSourceScope:
      'Final full-game baseline sourceBefore/sourceAfter includes runtime/client/tests/fixtures and SDK dependencies; docs/fidelity excluded',
    shippedGameFiles: Object.keys(gameSources()).length,
    sourceRestored,
    restored: sourceRestored,
    incomplete: !passed,
    passed: !!passed,
    status: passed ? 'passed' : stage,
    error,
  });
}
function cleanup() {
  const checked = resolve(reportDir);
  if (!checked.startsWith(resolve(tmpdir(), 'r1-local-P05-mutations-')))
    throw new Error('Unexpected owned mutation report directory');
  rmSync(checked, { recursive: true, force: true });
}

try {
  if (baselineOnly) {
    const previous = JSON.parse(readFileSync(finalFile, 'utf8'));
    if (
      previous.completedMutants !== 20 ||
      previous.mutations.length !== 20 ||
      previous.mutations.filter((item) => item.killed).length < 19 ||
      !sameSources(previous.sourceHashes, sourceHashes) ||
      !sameSources(previous.dependencyHashes, dependencyHashes) ||
      !sameSources(previous.testSources, testSources)
    )
      throw new Error(
        'Mutation source/dependency/rules-test evidence changed; rerun all mutations',
      );
    if (fullRuns !== 1000 && !freshSimulationMatches())
      throw new Error('A pilot baseline requires a source-matching complete 7,000-match proof');
    writeJson(finalFile, {
      ...previous,
      baselineOnlyStartedAt: startedAt,
      passed: false,
      incomplete: true,
      status: 'baseline-running',
      error: null,
    });
    const run = await runTests(['games/agar-io'], true);
    const simPassed = fullRuns === 1000 ? recordSimulation(run) : freshSimulationMatches();
    const sourceRestored = restored();
    const passed = run.success && sourceRestored && simPassed;
    writeJson(finalFile, {
      ...previous,
      restoredCommand: run.command,
      restoredBaseline: run,
      sourceFilesMeaning: 'Original mutation-time runtime count, not final baseline runtime count',
      mutationRuntimeFileCount: previous.mutationRuntimeFileCount ?? previous.sourceFiles,
      // Older completed mutation runs did not persist their full runtime hash map.
      // Preserve that absence; current client bytes cannot reconstruct historical bytes.
      recordedMutationRuntimeHashes: previous.recordedMutationRuntimeHashes ?? null,
      finalBaselineRuntimeHashes: runtimeHashPart(run.sourceBefore),
      finalBaselineRuntimeHashesAfter: runtimeHashPart(run.sourceAfter),
      finalBaselineRuntimeFileCount: Object.keys(runtimeHashPart(run.sourceBefore)).length,
      sourceScope:
        'Server/content/manifest and focused rule-test mutation evidence plus SDK/shared/dependency configuration',
      baselineSourceScope:
        'Final full-game baseline sourceBefore/sourceAfter includes runtime/client/tests/fixtures and SDK dependencies; docs/fidelity excluded',
      baselineAttempts: [
        ...(previous.baselineAttempts ??
          (previous.restoredBaseline ? [previous.restoredBaseline] : [])),
        run,
      ],
      baselineOnlyStartedAt: startedAt,
      finishedAt: passed ? run.finishedAt : null,
      elapsedMs: (previous.elapsedMs ?? 0) + run.elapsedMs,
      sourceRestored,
      restored: sourceRestored,
      incomplete: !passed,
      passed,
      status: passed ? 'passed' : 'baseline-failed',
      error: passed ? null : 'Restored own-game baseline or source-bound simulations failed',
    });
    console.log(
      JSON.stringify({
        stage: 'restored-baseline',
        passed,
        passedTests: run.passedTests,
        failedTests: run.failedTestCount,
        files: run.files,
        elapsedMs: run.elapsedMs,
        sourcesStable: run.sourcesStable,
        failedAssertions: run.failedTests,
      }),
    );
    if (!passed) process.exitCode = 1;
  } else {
    checkpoint('starting');
    // Missing targets are rejected before any source is planted; no historical PASS remains.
    for (const mutation of mutations) {
      const matches = originals.get(mutation.file).toString('utf8').split(mutation.from).length - 1;
      if (matches !== 1)
        throw new Error(mutation.id + ': expected exactly one source match, found ' + matches);
    }
    if (fullRuns !== 1000)
      throw new Error('Fresh mutation verification requires 1,000 simulation runs per count');
    baseline = await runTests();
    checkpoint('baseline');
    if (!baseline.success) throw new Error('Unmodified focused own-game baseline must pass');
    for (const mutation of mutations) {
      const file = resolve(server, mutation.file);
      const original = originals.get(mutation.file);
      let run;
      let plantedSha256;
      try {
        writeFileSync(file, original.toString('utf8').replace(mutation.from, mutation.to), 'utf8');
        plantedSha256 = digest(readFileSync(file));
        run = await runTests(testsById[mutation.id]);
      } finally {
        writeFileSync(file, original);
        if (!readFileSync(file).equals(original))
          throw new Error(mutation.id + ': byte restoration failed');
      }
      const killed =
        run.exitCode !== 0 &&
        run.semanticFailures.length > 0 &&
        run.invalidFailures.length === 0 &&
        run.brokenSuites.length === 0 &&
        run.error === null &&
        run.reportError === null &&
        run.sourcesStable;
      const outcome = {
        ...mutation,
        tests: testsById[mutation.id],
        killed,
        plantedSha256,
        restoredSha256: digest(original),
        exitCode: run.exitCode,
        failedTests: run.failedTests,
        semanticFailureCount: run.semanticFailures.length,
        invalidFailures: run.invalidFailures,
        brokenSuites: run.brokenSuites,
        error: run.error,
        reportError: run.reportError,
        passedTests: run.passedTests,
        totalTests: run.totalTests,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        elapsedMs: run.elapsedMs,
        command: run.command,
        sourcesStable: run.sourcesStable,
        sourceChanges: run.sourceChanges,
        outputTail: run.outputTail,
      };
      outcomes.push(outcome);
      checkpoint('running');
      console.log(
        JSON.stringify({
          id: mutation.id,
          killed,
          semanticFailureCount: outcome.semanticFailureCount,
          elapsedMs: run.elapsedMs,
          error: run.error,
        }),
      );
      if (!run.sourcesStable || !restored())
        throw new Error('Source changed during mutation verification');
    }
    restoreSources();
    checkpoint('restored');
    if (!deferBaseline) {
      // This single complete own-game run supplies the fresh 7,000-match proof too.
      writeJson(simFile, {
        status: 'running',
        incomplete: true,
        startedAt: new Date().toISOString(),
        expectedGames: 7000,
        games: 0,
        reports: [],
        sources: { ...sourceHashes, ...dependencyHashes },
      });
      restoredBaseline = await runTests(['games/agar-io'], true);
      const simPassed = recordSimulation(restoredBaseline);
      if (!restoredBaseline.success || !simPassed)
        throw new Error('Restored full own-game baseline or complete simulations failed');
      finishedAt = restoredBaseline.finishedAt;
    }
  }
} catch (failure) {
  error = failure.message;
  process.exitCode = 1;
  console.error(error);
} finally {
  try {
    // Baseline-only never plants source and therefore never owns source writes.
    if (!baselineOnly) restoreSources();
  } catch (failure) {
    error = [error, failure.message].filter(Boolean).join('; ');
    process.exitCode = 1;
    console.error(failure.message);
  }
  try {
    if (!baselineOnly)
      checkpoint(deferBaseline ? 'baseline-deferred' : 'failed', !deferBaseline && !!finishedAt);
    else if (error) {
      const previous = JSON.parse(readFileSync(finalFile, 'utf8'));
      writeJson(finalFile, {
        ...previous,
        passed: false,
        incomplete: true,
        status: 'baseline-failed',
        error,
      });
    }
  } finally {
    try {
      cleanup();
    } catch (failure) {
      process.exitCode = 1;
      console.error('Owned report cleanup failed: ' + failure.message);
    }
  }
}
if (!baselineOnly) {
  const killed = outcomes.filter((item) => item.killed).length;
  console.log(
    killed + '/' + mutations.length + ' semantic mutants caught; original bytes restored',
  );
  if (deferBaseline) console.log('Full own-game baseline and 7,000 matches deferred');
  if (killed < 19 || !restored()) process.exitCode = 1;
}
