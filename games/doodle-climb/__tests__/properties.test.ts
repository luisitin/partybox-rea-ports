import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROPERTY_SEEDS, propertyRun } from './properties';

describe('Doodle Climb seeded properties', () => {
  it('replays frozen state and shuffled inputs with JSON, privacy and range invariants for seeds 1, 2, 3 plus 1000', () => {
    let events = 0;
    for (const seed of PROPERTY_SEEDS) events += propertyRun(seed);
    expect(PROPERTY_SEEDS).toHaveLength(1003);
    expect(events).toBe(1003 * 37);
    const report = {
      seeds: PROPERTY_SEEDS.length,
      requiredSeeds: [1, 2, 3],
      additionalSeeds: 1000,
      shuffleSeed: 0x15d00d1e,
      events,
      fullViewAndRangeAudits: 1003 * 7,
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
    };
    writeFileSync(
      fileURLToPath(
        new URL('../../../jobs/P15-doodle-climb/tools/property-results.json', import.meta.url),
      ),
      JSON.stringify(report, null, 2) + '\n',
      'utf8',
    );
  }, 60_000);
});
