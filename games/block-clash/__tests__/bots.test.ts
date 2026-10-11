import { describe, expect, it } from 'vitest';
import { botBatch } from '../../../jobs/P11-tetris-clash/tools/simulate';
import { game } from '../server/index';

describe('seeded bot matches', () => {
  const counts = Array.from(
    { length: game.manifest.maxPlayers - game.manifest.minPlayers + 1 },
    (_, i) => game.manifest.minPlayers + i,
  );

  it.each(counts)(
    'terminates 1000 matches at %i players across all three strengths',
    (players) => {
      const report = botBatch(players);
      console.log(JSON.stringify(report));
      expect(report.runs).toBe(1000);
      expect(report.maximumMs).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 2 * 60_000);
      expect(report.medianMs).toBeGreaterThan(0);
      expect(report.maxEvents).toBeLessThan(20_000);
    },
    240_000,
  );
});
