import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { ROUND_MS } from '../server/types';
import { simulate, sweep } from '../../../jobs/P05-blob-arena/sim';

describe('seeded full-match bots', () => {
  it('replays the same shuffled, independently seeded eight-seat match', () => {
    expect(simulate(8, 731, 'sharp')).toEqual(simulate(8, 731, 'sharp'));
  });
  it.each([2, 3, 4, 5, 6, 7, 8])(
    '%i players: 1,000 games cycle all three strengths and end within estimate × 2',
    (players) => {
      const runs = Number(process.env['PB_SIM_RUNS'] ?? 1000);
      const report = sweep(players, runs);
      console.log(JSON.stringify(report));
      expect(report.games).toBe(runs);
      expect(report.maxGameMs).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 2 * 60000);
      expect(report.medianRoundMs).toBe(ROUND_MS);
      if (runs >= 3)
        for (const count of Object.values(report.gamesBySkill)) expect(count).toBeGreaterThan(0);
      expect(report.minScore).toBeGreaterThanOrEqual(0);
      expect(report.maxEvents).toBeLessThanOrEqual(5000);
    },
    1200000,
  );
});
