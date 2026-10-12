// Required seeded bots at every supported size and all three skill levels.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BotSkill } from '@partybox/game-sdk';
import { game } from '../server/index';
import { simulate } from './run';

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

describe.each([2, 3, 4, 5, 6, 7, 8])('1000 seeded matches at %i seats', (count) => {
  it('finishes five rounds with complete finite results inside estimate ×2', () => {
    const lengths: number[] = [];
    const rounds: number[] = [];
    const skillTotals: Record<BotSkill, { matches: number; elapsed: number; points: number }> = {
      easy: { matches: 0, elapsed: 0, points: 0 },
      normal: { matches: 0, elapsed: 0, points: 0 },
      sharp: { matches: 0, elapsed: 0, points: 0 },
    };
    for (let seed = 1; seed <= 1000; seed++) {
      const skill = (['easy', 'normal', 'sharp'] as const)[(seed - 1) % 3]!;
      const run = simulate(count, seed, skill, seed % 5 !== 0);
      const results = game.results(run.state);
      expect(run.state.round, `seed ${seed}`).toBe(5);
      expect(run.roundMs, `seed ${seed}`).toHaveLength(5);
      expect(run.elapsed, `seed ${seed}`).toBeLessThanOrEqual(
        game.manifest.estimatedMinutes * 120_000,
      );
      expect(Object.keys(results!.scores)).toHaveLength(count);
      expect(Object.values(results!.scores).every(Number.isFinite)).toBe(true);
      expect(results!.winnerIds.length).toBeGreaterThan(0);
      expect(JSON.stringify(run.state).length).toBeLessThan(256 * 1024);
      lengths.push(run.elapsed);
      rounds.push(...run.roundMs);
      skillTotals[skill].matches++;
      skillTotals[skill].elapsed += run.elapsed;
      skillTotals[skill].points += Object.values(results!.scores).reduce((a, b) => a + b, 0);
    }
    const evidence = {
      players: count,
      matches: lengths.length,
      medianRoundMs: median(rounds),
      medianMatchMs: median(lengths),
      longestMatchMs: Math.max(...lengths),
      strengths: skillTotals,
      seeds: '1..1000; every fifth match has weapon crates disabled',
    };
    if (process.env.PB_WRITE_EVIDENCE === '1') {
      const media = resolve(import.meta.dirname, '../../../jobs/P22-ricochet-rumble/media');
      mkdirSync(media, { recursive: true });
      writeFileSync(resolve(media, `sim-${count}.json`), JSON.stringify(evidence, null, 2) + '\n');
    }
  }, 600_000);
});
