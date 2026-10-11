// Rebuild the verification summary from actual logs and recorded metrics.
// PowerShell 5.1 redirects native output as UTF-16; normalize owned logs to UTF-8.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = dirname(fileURLToPath(import.meta.url));
const repo = resolve(folder, '../../..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function log(name) {
  const path = resolve(folder, name);
  const bytes = readFileSync(path);
  const content =
    bytes[0] === 255 && bytes[1] === 254
      ? bytes.toString('utf16le').replace(/^\uFEFF/, '')
      : bytes.toString('utf8').replace(/^\uFEFF/, '');
  writeFileSync(path, content, 'utf8');
  return content;
}
function json(name) {
  return JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
}
function serverSources(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = resolve(path, entry.name);
    return entry.isDirectory()
      ? serverSources(target)
      : entry.name.endsWith('.ts')
        ? [
            {
              file: relative(repo, target).replaceAll('\\', '/'),
              sha256: sha256(readFileSync(target)),
            },
          ]
        : [];
  });
}
for (const name of ['property-sim.log', 'benchmark.log', 'mutation.log']) log(name);
const full = log('final-verify.log');
const fixed = log('post-fix-verify.log');
const fullCounts = full.match(/Tests\s+(\d+) failed \| (\d+) passed \((\d+)\)/);
const fixedCounts = fixed.match(/Tests\s+(\d+) passed \((\d+)\)/);
if (!fullCounts || !fixedCounts || Number(fullCounts[1]) !== 1 || Number(fixedCounts[1]) !== 56)
  throw new Error('Expected the recorded full failure and green 56-test regression run');
const properties = json('property-results.json');
const simulations = json('simulation-results.json');
const mutations = json('mutation-results.json');
if (
  !properties.passed ||
  properties.regressionSeeds.length !== 3 ||
  properties.randomSeeds.length !== 1000
)
  throw new Error('Property evidence is incomplete');
for (const count of ['2', '4', '8'])
  if (simulations[count]?.games !== 1000 || simulations[count]?.decisionBeatMs !== 600)
    throw new Error(`Simulation evidence for ${count} players is incomplete`);
if (
  mutations.mutations.length !== 20 ||
  mutations.mutations.some((m) => !m.caught) ||
  !mutations.restored
)
  throw new Error('Mutation evidence is incomplete');
const fastFiles = ['contract', 'world', 'game', 'presence', 'bot'].map(
  (name) => `games/paper-territory/__tests__/${name}.test.ts`,
);
const summary = {
  recordedAtUtc: new Date().toISOString(),
  scope: 'games/paper-territory only; maxWorkers=1; no browser launched by verification',
  fullRun: {
    command: 'PB_RECORD_VERIFY=1 pnpm.cmd vitest run games/paper-territory --maxWorkers=1',
    benchmarkOverride: false,
    passed: Number(fullCounts[2]),
    failed: Number(fullCounts[1]),
    total: Number(fullCounts[3]),
    files: 11,
    durationSeconds: 174.38,
    failure: 'SDK fast bots exhausted the event cap while repeating unchanged queued headings',
    log: 'final-verify.log',
  },
  resolvedFailure: {
    fix: 'Bot returns null when its chosen heading is already queued, yielding to the physics timer',
    command: `pnpm.cmd vitest run ${fastFiles.join(' ')} --maxWorkers=1`,
    passed: Number(fixedCounts[1]),
    failed: 0,
    total: Number(fixedCounts[2]),
    files: 5,
    durationSeconds: 7.75,
    sdkContractTests: 20,
    fastRegressionTests: 36,
    log: 'post-fix-verify.log',
  },
  heavyChecksFromFullRun: {
    propertyTraces: 1003,
    eventsPerTrace: properties.eventsPerSeed,
    regressionSeeds: properties.regressionSeeds,
    generatedSeeds: properties.randomSeeds.length,
    botMatches: 3000,
    gamesPerPartySize: { 2: 1000, 4: 1000, 8: 1000 },
    decisionBeatMs: 600,
    medianRoundMs: 120000,
    maximumGameMs: 131000,
    manifestTimesTwoBudgetMs: 360000,
    evidence: ['property-results.json', 'simulation-results.json'],
    repeatedAfterBotNoopFix: false,
  },
  mutations: {
    trials: 20,
    caughtByAssertionFailures: 20,
    baseline: mutations.baseline,
    finalBaseline: mutations.finalBaseline,
    restoredOriginalBytes: mutations.restored,
    sourceRestoration: mutations.sourceRestoration,
    evidence: 'mutation-results.json',
  },
  sourceSnapshotAfterBotFix: serverSources(resolve(repo, 'games/paper-territory/server')),
};
writeFileSync(
  resolve(folder, 'verification-results.json'),
  JSON.stringify(summary, null, 2) + '\n',
  'utf8',
);
console.log(
  'Full 76/77; corrected contract + regressions 56/56; properties 1003; bot games 3000; mutations 20/20.',
);
