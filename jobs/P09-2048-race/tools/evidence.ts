// Finalize reproducible evidence only after simulations, behavior mutations and captures pass.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';

const job = 'jobs/P09-2048-race';
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const hash = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const files = (path: string): string[] =>
  readdirSync(path, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? files(`${path}/${entry.name}`) : [`${path}/${entry.name}`],
    )
    .sort();

const simulation = read(`${job}/simulation.json`);
const mutations = read(`${job}/mutations.json`);
const layout = read(`${job}/media/layout.json`);
if (simulation.incomplete || simulation.completedGames !== 21000)
  throw new Error('Incomplete simulations');
if (!mutations.passed || !mutations.restored || mutations.caughtMutants !== 20)
  throw new Error('Mutation evidence requires restored green baseline and 20 behavior kills');
if (!mutations.restoredBaseline.sourcesStable || !mutations.restoredBaseline.sources)
  throw new Error('The final own-game baseline must have stable client/test source hashes');
for (const artifact of [
  simulation.sources,
  mutations.sourceHashes,
  mutations.restoredBaseline.sources,
]) {
  for (const [path, expected] of Object.entries(artifact)) {
    if (hash(path) !== expected) throw new Error(`Evidence source drift: ${path}`);
  }
}
for (const frame of layout.captures) {
  if (
    frame.outside.length ||
    frame.clipping.length ||
    frame.boardOverlaps.length ||
    frame.headerOverlap > 1 ||
    (frame.keyboardFocus && !frame.keyboardFocus.ariaDisabledRetainsFocus) ||
    frame.tvTextBelow32px.length ||
    frame.directionTargets.some((target: { passes44px: boolean }) => !target.passes44px)
  )
    throw new Error(`Capture failed: ${frame.html}`);
}

const sourceHashes = Object.fromEntries(files('games/2048').map((path) => [path, hash(path)]));
const metadata = {
  scope: 'Current-source behavior, seeded completion and static pinned-host visual evidence',
  sourceHashes,
  tests: mutations.restoredBaseline.passedTests,
  testFiles: mutations.restoredBaseline.files,
  sdkContracts: 20,
  raceSeeds: 1003,
  simulatedBotGames: simulation.completedGames,
  maxCompletionMs: Math.max(
    ...simulation.summaries.map((group: { maxTotalMs: number }) => group.maxTotalMs),
  ),
  completionLimitMs: simulation.limitMs,
  mutationKills: mutations.caughtMutants,
  capturedFrames: layout.captures.length,
  manualReviewed: 27,
  hostCore: '6ce46e613d3705624a56647592979613c4d6e468',
  latestCoreOverlapScan: 'e73c6a2fb776ae355769ffa8074a24ace996b6d6',
  overlapManifestCount: 126,
  phone: { headerPx: 60, counterPx: 27.6 },
  tv: { stagePx: 854.8, innerPx: 788.8 },
  limitations:
    'Static SSR and reconstructed pinned host chrome; receipt stress text is supplied to its real status slot. No running-room or live-original visual/audio play claim.',
};
writeFileSync(
  `${job}/media/current-source.json`,
  await format(JSON.stringify(metadata), {
    ...(await resolveConfig('.prettierrc')),
    parser: 'json',
  }),
  'utf8',
);
const mediaFiles = files(`${job}/media`);
const bytes = mediaFiles.reduce((total, path) => total + statSync(path).size, 0);
if (bytes >= 10000000) throw new Error(`Media budget exceeded: ${bytes}`);
const sums = mediaFiles.map((path) => `${hash(path)}  ${path.slice(job.length + 1)}`);
writeFileSync(`${job}/SHA256SUMS.txt`, `${sums.join('\n')}\n`, 'utf8');
// Independent read-back catches path/encoding mistakes instead of trusting the write.
for (const line of readFileSync(`${job}/SHA256SUMS.txt`, 'utf8').trim().split('\n')) {
  const [expected, path] = line.split('  ');
  if (hash(resolve(job, path!)) !== expected) throw new Error(`Media checksum mismatch: ${path}`);
}
console.log(
  JSON.stringify({
    tests: metadata.tests,
    simulations: metadata.simulatedBotGames,
    mutationKills: metadata.mutationKills,
    captures: metadata.capturedFrames,
    mediaFiles: mediaFiles.length,
    bytes,
    checksumsVerified: mediaFiles.length,
  }),
);
