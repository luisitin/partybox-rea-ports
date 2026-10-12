// Import explicit successful CI simulation evidence after byte-level provenance audit.
// This never executes game code, tests, mutations, or a browser.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  behaviorSources,
  dependencySources,
  runtimeSources,
  digest,
  hashes,
  root,
  sameSources,
  sourceChanges,
} from './provenance.mjs';

const runId = process.argv[2] ?? '38279669664';
const logPath = process.argv[3] ?? 'jobs/P05-blob-arena/ci-936fb63.log';
const requireCurrentRuntime = process.env.PB_CI_REQUIRE_CURRENT_RUNTIME === '1';
const expectedTests = Number(process.env.PB_CI_EXPECTED_TESTS ?? 213);
const driverFiles = [
  'jobs/P05-blob-arena/sim.ts',
  'jobs/P05-blob-arena/provenance.mjs',
  'jobs/P05-blob-arena/provenance.d.mts',
  'games/agar-io/__tests__/sim.test.ts',
];
const currentRuntime = runtimeSources();
const currentDependencies = dependencySources();
const currentDrivers = hashes(driverFiles);
const currentAuditBefore = { ...currentRuntime, ...currentDependencies, ...currentDrivers };
if (!/^\d+$/.test(runId)) throw new Error('Invalid CI run id');
if (requireCurrentRuntime && (!Number.isInteger(expectedTests) || expectedTests < 1))
  throw new Error('Invalid expected current-runtime test count');
const result = spawnSync(
  'gh',
  [
    'run',
    'view',
    runId,
    '--repo',
    'luisitin/partybox-rea-ports',
    '--json',
    'headSha,conclusion,status,createdAt,updatedAt,url,jobs',
  ],
  {
    cwd: root,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 2 * 1024 * 1024,
  },
);
if (result.status !== 0) throw new Error('Cannot read successful CI metadata: ' + result.stderr);
const meta = JSON.parse(result.stdout);
if (
  meta.status !== 'completed' ||
  meta.conclusion !== 'success' ||
  !/^[a-f0-9]{40}$/.test(meta.headSha)
)
  throw new Error('CI proof requires a completed successful immutable head');
const verify = meta.jobs.find((job) => job.name === 'verify' && job.conclusion === 'success');
const sourceStep = verify?.steps.find(
  (step) =>
    step.name === 'Run node jobs/P05-blob-arena/record-source.mjs' && step.conclusion === 'success',
);
const testStep = verify?.steps.find(
  (step) =>
    step.name === 'Run pnpm vitest run games/agar-io --maxWorkers=1 --disableConsoleIntercept' &&
    step.conclusion === 'success',
);
if (!sourceStep || !testStep)
  throw new Error('Successful source-record and scoped test steps are required');
const logBytes = readFileSync(resolve(root, logPath));
const log = logBytes
  .toString('utf8')
  .replace(/^\uFEFF/, '')
  .replace(/\x1b\[[0-9;]*m/g, '')
  .replace(/\^\[\[[0-9;]*m/g, '');
const rows = log.split(/\r?\n/);
let testedCommit = null;
for (let index = 0; index < rows.length - 1; index++) {
  if (!rows[index].includes('[command]/usr/bin/git log -1 --format=%H')) continue;
  testedCommit = rows[index + 1].match(/\b([a-f0-9]{40})\s*$/)?.[1] ?? null;
}
if (!testedCommit) throw new Error('Actual Actions checkout commit is missing from the log');
const objects = [];
for (const row of rows) {
  const start = row.indexOf('{');
  if (start < 0) continue;
  try {
    objects.push({
      value: JSON.parse(row.slice(start)),
      observedAt: row.match(/\b\d{4}-\d{2}-\d{2}T[^\s]+Z\b/)?.[0] ?? null,
    });
  } catch {}
}
const ledgers = objects.filter(
  (object) =>
    object.value.game === 'agar-io' &&
    object.value.runtimeSources &&
    object.value.dependencySources &&
    Array.isArray(object.value.ledger),
);
if (ledgers.length !== 1) throw new Error('Require exactly one actual logged source ledger');
const recorded = ledgers[0].value;
const recordedGame = Object.fromEntries(recorded.ledger.map((entry) => [entry.path, entry.sha256]));
if (
  recorded.sourceFiles !== recorded.ledger.length ||
  Object.keys(recordedGame).length !== recorded.sourceFiles
)
  throw new Error('Recorded game ledger has missing/duplicate paths');
const groups = objects.filter(
  (object) =>
    Number.isInteger(object.value.players) &&
    Number.isInteger(object.value.games) &&
    object.value.gamesBySkill,
);
if (groups.length !== 7)
  throw new Error('Require exactly seven actual logged seeded sweep reports');
const reports = groups.map((object) => object.value);
const manifest = JSON.parse(readFileSync(resolve(root, 'games/agar-io/manifest.json'), 'utf8'));
const limit = manifest.estimatedMinutes * 2 * 60000;
for (const count of [2, 3, 4, 5, 6, 7, 8]) {
  const matches = reports.filter((group) => group.players === count);
  if (matches.length !== 1) throw new Error('Missing or duplicate player count ' + count);
  const group = matches[0];
  if (
    group.games !== 1000 ||
    group.gamesBySkill.easy !== 334 ||
    group.gamesBySkill.normal !== 333 ||
    group.gamesBySkill.sharp !== 333 ||
    group.medianRoundMs !== 90000 ||
    !Number.isFinite(group.medianGameMs) ||
    group.medianGameMs > limit ||
    !Number.isFinite(group.maxGameMs) ||
    group.maxGameMs > limit ||
    group.maxEvents > 5000 ||
    !Number.isFinite(group.minScore) ||
    group.minScore < 0 ||
    !Number.isFinite(group.maxScore)
  )
    throw new Error('Actual seeded report failed count/strength/median/limit checks: ' + count);
}
const testSummary = log.match(/\bTests\s+(\d+) passed\s*\((\d+)\)/);
const fileSummary = log.match(/Test Files\s+(\d+) passed\s*\((\d+)\)/);
const duration = log.match(/Duration\s+([\d.]+)s/);
if (
  !testSummary ||
  Number(testSummary[1]) < 1 ||
  testSummary[1] !== testSummary[2] ||
  !fileSummary ||
  Number(fileSummary[1]) < 1 ||
  fileSummary[1] !== fileSummary[2] ||
  !duration
)
  throw new Error('Successful scoped test summary missing from actual log');
if (requireCurrentRuntime && Number(testSummary[1]) !== expectedTests)
  throw new Error('Current-runtime CI test count differs from expected ' + expectedTests);
const currentBehavior = behaviorSources();
const recordedBehavior = Object.fromEntries(
  Object.keys(currentBehavior).map((path) => [path, recorded.runtimeSources[path]]),
);
if (
  !sameSources(recordedBehavior, currentBehavior) ||
  !sameSources(recorded.dependencySources, currentDependencies)
)
  throw new Error(
    'CI source bytes differ: ' +
      JSON.stringify({
        behavior: sourceChanges(recordedBehavior, currentBehavior),
        dependencies: sourceChanges(recorded.dependencySources, currentDependencies),
      }),
  );
const actualRecorded = {
  ...recordedGame,
  ...recorded.runtimeSources,
  ...recorded.dependencySources,
};
const paths = [...new Set([...Object.keys(actualRecorded), ...driverFiles])].sort();
const git = spawnSync('git', ['cat-file', '--batch'], {
  cwd: root,
  windowsHide: true,
  input: paths.map((path) => testedCommit + ':' + path + '\n').join(''),
  maxBuffer: 32 * 1024 * 1024,
});
if (git.status !== 0) throw new Error('Cannot read tested commit blobs');
let cursor = 0;
const committed = {};
for (const path of paths) {
  const end = git.stdout.indexOf(10, cursor);
  const header = git.stdout.subarray(cursor, end).toString('utf8');
  const match = header.match(/^([a-f0-9]{40}) blob (\d+)$/);
  if (!match) throw new Error('Missing tested blob: ' + path + ' ' + header);
  const size = Number(match[2]);
  const bytes = git.stdout.subarray(end + 1, end + 1 + size);
  if (bytes.length !== size) throw new Error('Truncated tested blob: ' + path);
  committed[path] = digest(bytes);
  if (actualRecorded[path] && actualRecorded[path] !== committed[path])
    throw new Error('Actual CI ledger differs from tested git blob: ' + path);
  cursor = end + 1 + size + 1;
}
const driverSources = Object.fromEntries(driverFiles.map((path) => [path, committed[path]]));
if (!sameSources(driverSources, currentDrivers))
  throw new Error('Current simulation driver/test differs from tested commit');
const runtimeChanges = sourceChanges(recorded.runtimeSources, currentRuntime);
if (requireCurrentRuntime && runtimeChanges.length)
  throw new Error('Current-runtime CI evidence differs: ' + JSON.stringify(runtimeChanges));
if (
  runtimeChanges.some(
    ({ path }) =>
      !path.startsWith('games/agar-io/client/') &&
      path !== 'games/agar-io/__tests__/screens.test.tsx',
  )
)
  throw new Error(
    'Unexpected non-client runtime differences from successful CI: ' +
      JSON.stringify(runtimeChanges),
  );
const currentAuditAfter = {
  ...runtimeSources(),
  ...dependencySources(),
  ...hashes(driverFiles),
};
if (!sameSources(currentAuditBefore, currentAuditAfter))
  throw new Error(
    'Source bytes changed during CI import: ' +
      JSON.stringify(sourceChanges(currentAuditBefore, currentAuditAfter)),
  );
const importedAt = new Date().toISOString();
const ciAudit = {
  importedAt,
  runId,
  head: meta.headSha,
  testedCommit,
  apiHeadMeaning:
    'Pull request branch head; Actions checked out the separately recorded merge commit',
  url: meta.url,
  conclusion: meta.conclusion,
  runner: 'GitHub Actions ubuntu-latest, Node24, one scoped Vitest worker',
  actualApiMetadata: meta,
  archivedLog: logPath,
  archivedLogSha256: digest(logBytes),
  actualLoggedSourceLedger: recorded,
  sourceLedgerObservedAt: ledgers[0].observedAt,
  committedBlobHashes: committed,
  committedBlobMatchesActualLoggedLedger: true,
  behaviorSourcesMatchCurrent: true,
  dependenciesMatchCurrent: true,
  driverSourcesMatchCurrent: true,
  runtimeSourcesMatchCurrent: runtimeChanges.length === 0,
  currentRuntimeChanges: runtimeChanges,
  runtimeDifferenceScope: requireCurrentRuntime
    ? 'Every runtime/client/test/fixture and SDK/config raw byte matches the actual successful CI source ledger and tested checkout blobs'
    : 'Client-only differences are expected after CI; this CI full baseline is historical for final UI',
  currentAuditSourcesBefore: currentAuditBefore,
  currentAuditSourcesAfter: currentAuditAfter,
  currentAuditSourcesStable: true,
  driverSourceBasis:
    'Computed from immutable actual Actions checkout merge-commit blobs and independently matched to current raw bytes; sim.test.ts also appears in the actual logged runtime ledger',
  sourcePostExecutionLedgerRecorded: false,
  baseline: {
    passedTests: Number(testSummary[1]),
    files: Number(fileSummary[1]),
    elapsedMs: Number(duration[1]) * 1000,
    startedAt: testStep.startedAt,
    finishedAt: testStep.completedAt,
  },
};
if (requireCurrentRuntime) {
  writeFileSync(
    resolve(root, 'jobs/P05-blob-arena/ci-current-full-test-proof.json'),
    JSON.stringify(
      {
        ...ciAudit,
        status: 'passed',
        incomplete: false,
        proofScope:
          'Actual successful full own-game CI test result plus logged pre-test runtime/dependency bytes, audited against immutable tested merge blobs and current raw bytes before/after import',
        command: testStep.name.slice(4),
        postExecutionLedgerNote:
          'CI recorded one pre-test ledger. No post-test source ledger or post-test raw hashes are invented; currentAuditSourcesStable describes the independent import-time audit.',
        localBaselinePolicy:
          'The local pre-CSS baseline and its actual historical runtime hashes remain unchanged in mutations.json',
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
}
const sim = {
  runId: 'r1-local',
  status: 'passed',
  incomplete: false,
  proofOrigin: 'Successful source-audited GitHub Actions scoped game run',
  command: testStep.name.slice(4),
  startedAt: testStep.startedAt,
  finishedAt: testStep.completedAt,
  elapsedMs: null,
  ciFullTestElapsedMs: ciAudit.baseline.elapsedMs,
  simulationWallDurationNote:
    'The log reports total scoped test duration; no isolated simulation duration is invented',
  sourceScope:
    'Actual CI logged server/content/manifest and SDK/shared/config bytes; committed simulation driver/test binding. Client-only differences do not affect the sweep.',
  sources: { ...recordedBehavior, ...recorded.dependencySources },
  driverSources,
  driverSourcesAfter: null,
  driverSourceBasis: ciAudit.driverSourceBasis,
  verificationMode: 'source-audited-ci-reuse',
  ci: ciAudit,
  runsPerCount: 1000,
  seedRange: [1, 1000],
  counts: [2, 3, 4, 5, 6, 7, 8],
  expectedGames: 7000,
  games: reports.reduce((sum, group) => sum + group.games, 0),
  maxAllowedGameMs: limit,
  maxGameMs: Math.max(...reports.map((group) => group.maxGameMs)),
  medianRoundMs: 90000,
  maxEvents: Math.max(...reports.map((group) => group.maxEvents)),
  totalEvents: reports.reduce((sum, group) => sum + group.totalEvents, 0),
  reports,
  reportObservedAt: groups.map((group) => ({
    players: group.value.players,
    observedAt: group.observedAt,
  })),
  importedAt,
};
writeFileSync(
  resolve(root, 'jobs/P05-blob-arena/ci-simulation-proof.json'),
  JSON.stringify(ciAudit, null, 2) + '\n',
  'utf8',
);
writeFileSync(
  resolve(root, 'jobs/P05-blob-arena/sim-report.json'),
  JSON.stringify(sim, null, 2) + '\n',
  'utf8',
);
console.log(
  JSON.stringify({
    runId,
    head: meta.headSha,
    testedCommit,
    passedTests: ciAudit.baseline.passedTests,
    files: ciAudit.baseline.files,
    ciElapsedMs: ciAudit.baseline.elapsedMs,
    games: sim.games,
    maxGameMs: sim.maxGameMs,
    totalEvents: sim.totalEvents,
    maxEvents: sim.maxEvents,
    committedBlobAudits: paths.length,
    currentRuntimeChanges: runtimeChanges,
    behaviorSourcesMatchCurrent: true,
    dependencySourcesMatchCurrent: true,
    driverSourcesMatchCurrent: true,
    runtimeSourcesMatchCurrent: runtimeChanges.length === 0,
    requireCurrentRuntime,
  }),
);
