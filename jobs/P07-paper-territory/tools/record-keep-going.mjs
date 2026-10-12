// Snapshot the final source before a run, then record actual full-run results.
// Run `node jobs/P07-paper-territory/tools/record-keep-going.mjs snapshot` before
// the final scoped Vitest command and run this script without arguments afterward.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = dirname(fileURLToPath(import.meta.url));
const repo = resolve(folder, '../../..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function codeFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = resolve(path, entry.name);
    return entry.isDirectory()
      ? codeFiles(target)
      : /\.(tsx?|css|json)$/.test(entry.name)
        ? [
            {
              file: relative(repo, target).replaceAll('\\', '/'),
              sha256: sha(readFileSync(target)),
            },
          ]
        : [];
  });
}
function json(name) {
  return JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
}
function log(name) {
  const path = resolve(folder, name);
  const bytes = readFileSync(path);
  const text =
    bytes[0] === 255 && bytes[1] === 254 ? bytes.toString('utf16le') : bytes.toString('utf8');
  const normalized = text.replace(/^\uFEFF/, '');
  writeFileSync(path, normalized, 'utf8');
  return normalized;
}
if (process.argv[2] === 'snapshot') {
  writeFileSync(
    resolve(folder, 'final-keep-going-source-hashes.json'),
    JSON.stringify(
      {
        recordedAtUtc: new Date().toISOString(),
        sources: codeFiles(resolve(repo, 'games/paper-io')),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log('Recorded the final game source snapshot.');
  process.exit(0);
}
const output = log('final-keep-going.log');
const tests = output.match(/Tests\s+(\d+) passed \((\d+)\)/);
const files = output.match(/Test Files\s+(\d+) passed \((\d+)\)/);
const duration = output.match(/Duration\s+([\d.]+)s/);
if (!tests || !files || !duration || /Failed Tests|Tests\s+\d+ failed/.test(output))
  throw new Error('Final scoped run must actually pass before recording green evidence');
const properties = json('property-results.json');
const simulations = json('simulation-results.json');
if (
  !properties.passed ||
  properties.regressionSeeds.length !== 3 ||
  properties.randomSeeds.length !== 1000
)
  throw new Error('Final property evidence is incomplete');
for (const count of ['2', '4', '8'])
  if (simulations[count]?.games !== 1000 || simulations[count]?.decisionBeatMs !== 600)
    throw new Error(`Final simulation evidence for ${count} players is incomplete`);
const snapshot = json('final-keep-going-source-hashes.json');
const command = json('final-keep-going-command.json');
const sourceComparison = snapshot.sources.map((source) => ({
  ...source,
  unchanged: sha(readFileSync(resolve(repo, source.file))) === source.sha256,
}));
if (sourceComparison.some((source) => !source.unchanged))
  throw new Error('Game source changed during the final run');
const before = json('keep-going-before-results.json')['8'];
const after = json('keep-going-after-results.json')['8'];
const baseline = json('pre-keep-going-simulation-results.json');
const metrics = Object.fromEntries(
  Object.entries(simulations).map(([count, value]) => [
    count,
    {
      games: value.games,
      medianRoundMs: value.medianRoundMs,
      maximumGameMs: value.maximumGameMs,
      budgetMs: value.budgetMs,
      decisionBeatMs: value.decisionBeatMs,
      bySkill: value.bySkill,
    },
  ]),
);
const results = {
  recordedAtUtc: new Date().toISOString(),
  status: 'passed',
  command: command.actualCommand,
  commandDetails: command,
  benchmarkOverride: false,
  browserLaunchedByVerification: false,
  fullRun: {
    files: Number(files[1]),
    tests: Number(tests[1]),
    failed: 0,
    durationSeconds: Number(duration[1]),
  },
  propertyTraces: 1003,
  generatedPropertySeeds: 1000,
  regressionPropertySeeds: properties.regressionSeeds,
  botMatches: 3000,
  metrics,
  opening: {
    legacyHeadSwaps: 'tick 8, slots 1/2/4/5',
    headings: [1, 3, 2, 0, 1, 3, 0, 2],
    initialHomeOffsets: [0, 0, -1, 1, 0, 0, 0, 0],
    protectedHomesUnchanged: true,
    respawnCentersUnchanged: true,
    zeroCasualtyOpeningMs: 2000,
    verifiedPlayerCounts: [2, 4, 8],
  },
  smallPairedBenchmark: {
    seeds: '1..20',
    gamesEach: 20,
    sharpGamesEach: before.bySkill.sharp.games,
    sharpSeatsEach: before.bySkill.sharp.players,
    before: before.bySkill.sharp,
    after: after.bySkill.sharp,
  },
  fullEightPlayerEcology: { before: baseline['8'].bySkill, after: simulations['8'].bySkill },
  interpretation:
    'Same-skill match ecology measures productive survival and growth; it does not establish mixed-skill ordering.',
  historicalEvidence:
    'verification-results.json and mutation-results.json remain the original pre-improvement experiment; their restored hashes are historical.',
  sourceSnapshot: 'final-keep-going-source-hashes.json',
  allSnapshotFilesUnchangedDuringRun: true,
  log: 'final-keep-going.log',
};
writeFileSync(
  resolve(folder, 'final-keep-going-results.json'),
  JSON.stringify(results, null, 2) + '\n',
  'utf8',
);
console.log(
  `${tests[1]}/${tests[2]} passed; 1003 property traces; 3000 seeded matches; all source hashes unchanged.`,
);
