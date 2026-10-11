import { writeFileSync } from 'node:fs';
import { botBatch } from '../../../games/block-clash/__tests__/simulate';
import { game } from '../../../games/block-clash/server/index';

const runsIndex = process.argv.indexOf('--runs');
const runs = runsIndex < 0 ? 1000 : Number(process.argv[runsIndex + 1]);
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');
const counts = Array.from(
  { length: game.manifest.maxPlayers - game.manifest.minPlayers + 1 },
  (_, i) => game.manifest.minPlayers + i,
);
const reports = counts.map((count) => {
  const report = botBatch(count, runs);
  console.log(JSON.stringify(report));
  return report;
});
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0)
  writeFileSync(process.argv[outIndex + 1]!, JSON.stringify(reports, null, 2) + '\n');
