// One worker verifies every supported count in both modes, cycling all three strengths.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BotSkill } from '@partybox/game-sdk';
import { game } from '../server/index';
import { simulate } from './run';
import type { RunMode } from './run';

const counts = Array.from({ length: 16 }, (_, i) => i + 1);
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
describe.each(['wager', 'classic'] as const)('%s mode', (mode: RunMode) => {
  describe.each(counts)('1000 seeded matches at %i seats', (count) => {
    it('terminates with every seat ranked and finite scores within estimate ×2', () => {
      const lengths: number[] = [];
      const rounds: number[] = [];
      const strengths: Record<BotSkill, { matches: number; elapsed: number }> = {
        easy: { matches: 0, elapsed: 0 },
        normal: { matches: 0, elapsed: 0 },
        sharp: { matches: 0, elapsed: 0 },
      };
      for (let seed = 1; seed <= 1000; seed++) {
        const skill = (['easy', 'normal', 'sharp'] as const)[(seed - 1) % 3]!;
        const run = simulate(count, seed, mode, skill);
        const result = game.results(run.state);
        expect(result, `seed ${seed}`).not.toBeNull();
        expect(result!.ranking, `seed ${seed}`).toHaveLength(count);
        expect(Object.keys(result!.scores), `seed ${seed}`).toHaveLength(count);
        expect(Object.values(result!.scores).every(Number.isFinite), `seed ${seed}`).toBe(true);
        expect(run.rounds, `seed ${seed}`).toHaveLength(mode === 'classic' ? 10 : 11);
        expect(run.state.questionIds, `seed ${seed}`).toHaveLength(mode === 'classic' ? 10 : 11);
        expect(run.elapsed, `seed ${seed}`).toBeLessThanOrEqual(
          game.manifest.estimatedMinutes * 120_000,
        );
        expect(JSON.stringify(run.state).length, `seed ${seed}`).toBeLessThan(256 * 1024);
        lengths.push(run.elapsed);
        rounds.push(...run.rounds);
        strengths[skill].matches++;
        strengths[skill].elapsed += run.elapsed;
      }
      if (process.env.PB_WRITE_EVIDENCE === '1') {
        const media = resolve(import.meta.dirname, '../../../jobs/P01-quiz-rush/media');
        mkdirSync(media, { recursive: true });
        writeFileSync(
          resolve(media, `sim-${mode}-${count}.json`),
          JSON.stringify(
            {
              mode,
              players: count,
              matches: 1000,
              medianRoundMs: median(rounds),
              medianMatchMs: median(lengths),
              longestMatchMs: Math.max(...lengths),
              strengths,
              measurement:
                'Round = used answer time + reveal/standings; match also includes intro/wager/podium.',
              seeds:
                '1..1000; three classic packs; every fourth wager game uses Spanish; every third room phone-only',
            },
            null,
            2,
          ) + '\n',
          'utf8',
        );
      }
    }, 600_000);
  });
});
