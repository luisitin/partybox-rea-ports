import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { botBatch } from './simulate';
import { game } from '../server/index';

describe('seeded bot matches', () => {
  const reports: ReturnType<typeof botBatch>[] = [];
  const counts = Array.from(
    { length: game.manifest.maxPlayers - game.manifest.minPlayers + 1 },
    (_, i) => game.manifest.minPlayers + i,
  );

  it.each(counts)(
    'terminates 1000 matches at %i players across all three strengths',
    (players) => {
      const report = botBatch(players);
      reports.push(report);
      writeFileSync(
        resolve(
          import.meta.dirname,
          '../../../jobs/P11-tetris-clash/tools/simulation-results.json',
        ),
        JSON.stringify(reports, null, 2) + '\n',
      );
      console.log(JSON.stringify(report));
      expect(report.runs).toBe(1000);
      expect(report.maximumMs).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 2 * 60_000);
      expect(report.medianMs).toBeGreaterThan(0);
      expect(report.maxEvents).toBeLessThan(20_000);
    },
    240_000,
  );
});
