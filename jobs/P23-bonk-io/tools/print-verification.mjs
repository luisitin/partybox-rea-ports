// Print completed CI measurements even when the test reporter hides successful console output.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const folder = resolve('jobs/P23-bonk-io/tools');
for (const n of [2, 3, 4, 5, 6, 7, 8]) {
  const report = JSON.parse(readFileSync(resolve(folder, `simulation-results/${n}.json`), 'utf8'));
  if (
    report.games !== 1000 ||
    report.players !== n ||
    report.maxMatchMs > report.matchLimitMs ||
    report.botDecisionMs !== 200 ||
    report.snapshotMs !== 80 ||
    JSON.stringify(report.botDecisionSpacingMs) !== '[160,240]'
  )
    throw new Error(`Incomplete ${n}-player batch`);
  console.log(`P23 SIM n=${n}: ${JSON.stringify(report)}`);
}
const property = JSON.parse(readFileSync(resolve(folder, 'property-results.json'), 'utf8'));
if (property.traces !== 1003) throw new Error('Incomplete property traces');
console.log(`P23 PROPERTY: ${JSON.stringify(property)}`);
