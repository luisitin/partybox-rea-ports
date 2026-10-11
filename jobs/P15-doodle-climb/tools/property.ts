import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROPERTY_SEEDS, propertyRun } from '../../../games/doodle-climb/__tests__/properties';

const started = performance.now();
let events = 0;
for (const seed of PROPERTY_SEEDS) events += propertyRun(seed);
const result = {
  seeds: PROPERTY_SEEDS.length,
  requiredSeeds: [1, 2, 3],
  additionalSeeds: 1000,
  shuffleSeed: 0x15d00d1e,
  events,
  invariants: [
    'deep-frozen state and events',
    'same-seed replay after every event',
    'JSON round-trip',
    'state ≤256KiB',
    'views ≤64KiB',
    'finite geometry',
    'wrapped x range',
    'nonnegative integer scores',
    'peak bound',
    'private RNG/world excluded',
    'future platforms excluded',
    'result completeness',
  ],
  passed: true,
  wallSeconds: Math.round((performance.now() - started) / 1000),
};
writeFileSync(
  fileURLToPath(new URL('./property-results.json', import.meta.url)),
  JSON.stringify(result, null, 2) + '\n',
  'utf8',
);
console.log(JSON.stringify(result));
