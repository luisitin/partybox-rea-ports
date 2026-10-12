// Extract authoritative scoped CI evidence without repeating desktop simulations.
// Fetch final-ci-run.json and final-ci.log with gh, then run this script.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = dirname(fileURLToPath(import.meta.url));
const repo = resolve(folder, '../../..');
const json = (name) => JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const run = json('final-ci-run.json');
if (run.status !== 'completed' || run.conclusion !== 'success') throw new Error('CI is not green');
const raw = readFileSync(resolve(folder, 'final-ci.log'), 'utf8');
const clean = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/\^\[\[[0-9;]*m/g, '');
const tests = clean.match(/Tests\s+(\d+) passed\s*\((\d+)\)/);
const files = clean.match(/Test Files\s+(\d+) passed\s*\((\d+)\)/);
const duration = clean.match(/Duration\s+([\d.]+)s/);
const command = clean.match(/##\[group\]Run (pnpm vitest run games\/paper-io --maxWorkers=1)/);
if (!tests || !files || !duration || !command) throw new Error('Scoped CI result is missing');
if (
  !/property\.test\.ts.*4 tests/.test(clean) ||
  !/preserves invariants and replay for 1000 reproducibly random seeds/.test(clean)
)
  throw new Error('All property trace assertions must pass in CI');
const metrics = {};
for (const line of clean.split(/\r?\n/)) {
  const match = line.match(/P07 SIM n=(2|4|8): (\{.*\})/);
  if (match) metrics[match[1]] = JSON.parse(match[2]);
}
for (const count of ['2', '4', '8']) {
  if (metrics[count]?.games !== 1000 || metrics[count]?.decisionBeatMs !== 600)
    throw new Error(`CI simulation batch ${count} is incomplete`);
}
const snapshot = json('final-keep-going-source-hashes.json');
const comparison = snapshot.sources.map((source) => ({
  ...source,
  currentSha256: sha(readFileSync(resolve(repo, source.file))),
  unchanged: sha(readFileSync(resolve(repo, source.file))) === source.sha256,
}));
const backend = comparison.filter(
  (source) =>
    source.file.includes('/server/') || source.file.endsWith('/__tests__/property.test.ts'),
);
if (backend.some((source) => !source.unchanged))
  throw new Error('Backend/property source changed since snapshot');
const properties = json('property-results.json');
if (
  properties.regressionSeeds.join(',') !== '1,2,3' ||
  properties.randomSeeds.length !== 1000 ||
  properties.randomSeedGenerator !== '0x5eed07'
)
  throw new Error('Seed evidence does not match the passed CI property harness');
const before = json('pre-keep-going-simulation-results.json');
const smallBefore = json('keep-going-before-results.json')['8'];
const smallAfter = json('keep-going-after-results.json')['8'];
const propertyEvidence = {
  ...properties,
  passed: true,
  evidenceSource:
    'authoritative CI property.test.ts: all four tests passed; regression seeds 1/2/3 plus 1000 generated traces',
  ciRunUrl: run.url,
  testedHeadSha: run.headSha,
  generatorAndSeedListUnchanged: true,
};
writeFileSync(
  resolve(folder, 'property-results.json'),
  JSON.stringify(propertyEvidence, null, 2) + '\n',
  'utf8',
);
writeFileSync(
  resolve(folder, 'simulation-results.json'),
  JSON.stringify(metrics, null, 2) + '\n',
  'utf8',
);
writeFileSync(
  resolve(folder, 'final-keep-going-simulation-results.json'),
  JSON.stringify(
    {
      evidenceSource: 'CI stdout P07 SIM JSON blocks',
      ciRunUrl: run.url,
      testedHeadSha: run.headSha,
      metrics,
    },
    null,
    2,
  ) + '\n',
  'utf8',
);
const results = {
  recordedAtUtc: new Date().toISOString(),
  status: 'passed',
  evidenceSource: 'authoritative scoped CI; local duplicate stopped to preserve desktop CPU',
  ciRunUrl: run.url,
  testedHeadSha: run.headSha,
  command: command[1],
  maxWorkers: 1,
  benchmarkOverride: false,
  fullRun: {
    files: Number(files[1]),
    tests: Number(tests[1]),
    failed: 0,
    durationSeconds: Number(duration[1]),
  },
  propertyTraces: 1003,
  generatedSeeds: properties.randomSeeds.length,
  regressionSeeds: properties.regressionSeeds,
  propertyEvidence: 'property-results.json',
  botMatches: 3000,
  metrics,
  opening: {
    legacyHeadSwapTick: 8,
    legacyAffectedSlots: [1, 2, 4, 5],
    headings: [1, 3, 2, 0, 1, 3, 0, 2],
    initialHomeOffsets: [0, 0, -1, 1, 0, 0, 0, 0],
    protectedHomesUnchanged: true,
    respawnCentersUnchanged: true,
    zeroCasualtyOpeningMs: 2000,
    verifiedPlayerCounts: [2, 4, 8],
  },
  smallPairedBenchmark: {
    gamesEach: 20,
    sharpGamesEach: smallBefore.bySkill.sharp.games,
    sharpSeatsEach: smallBefore.bySkill.sharp.players,
    before: smallBefore.bySkill.sharp,
    after: smallAfter.bySkill.sharp,
  },
  fullEightPlayerEcology: { before: before['8'].bySkill, after: metrics['8'].bySkill },
  interpretation:
    'Same-skill ecology measures productive growth and survival; it does not establish mixed-skill ordering.',
  localAttempts: {
    final: false,
    interrupted: true,
    commandDetails: json('final-keep-going-command.json'),
    logs: ['final-keep-going-ps-interrupted.log', 'final-keep-going.log'],
  },
  historicalEvidence:
    'verification-results.json and mutation-results.json preserve the original experiment and restoration hashes, rather than claiming those hashes describe the new source.',
  sourceSnapshot: 'final-keep-going-source-hashes.json',
  backendAndPropertySourcesUnchangedSinceSnapshot: true,
  sourceComparison: comparison,
  clientChangesAfterCi: comparison.filter((source) => !source.unchanged),
  subsequentClientValidation:
    'Parent owns targeted Map/roster checks and the next full CI after client-only R7/R8 fixes.',
  log: 'final-ci.log',
};
writeFileSync(
  resolve(folder, 'final-keep-going-results.json'),
  JSON.stringify(results, null, 2) + '\n',
  'utf8',
);
console.log(
  `${tests[1]}/${tests[2]} CI tests passed in ${duration[1]}s; 1003 traces; 3000 matches; backend/property hashes unchanged.`,
);
