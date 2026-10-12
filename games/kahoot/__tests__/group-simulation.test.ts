// Separate group coverage leaves the canonical 32,000 wager/classic simulations unchanged.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BotSkill } from '@partybox/game-sdk';
import { CLASSIC_PACK_IDS } from '../content/classic-schema';
import { CLASSIC_PACKS } from '../server/classic';
import { game } from '../server/index';
import { groupStandings } from '../server/teams';
import { simulateGroup } from './group-run';

const requestedRuns = process.env.P02_SIM_RUNS;
const RUNS = requestedRuns === undefined ? 1000 : Number(requestedRuns);
if (!Number.isSafeInteger(RUNS) || RUNS < 1 || RUNS > 1000)
  throw new Error(
    'P02_SIM_RUNS must be an integer from 1 to 1000; omit it for the required campaign',
  );
const counts = [2, 3, 4, 5, 6, 7, 8];
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

describe.each(['teams', 'tv-vote'] as const)('%s group simulation', (mode) => {
  describe.each(counts)(`${RUNS} seeded default matches at %i seats`, (count) => {
    it('terminates with complete finite results, bounded JSON and estimate ×2', () => {
      const lengths: number[] = [];
      const rounds: number[] = [];
      const strengths: Record<BotSkill, { matches: number; elapsedMs: number }> = {
        easy: { matches: 0, elapsedMs: 0 },
        normal: { matches: 0, elapsedMs: 0 },
        sharp: { matches: 0, elapsedMs: 0 },
      };
      const packs = Object.fromEntries(CLASSIC_PACK_IDS.map((pack) => [pack, 0]));
      const packStrengths = Object.fromEntries(
        CLASSIC_PACK_IDS.map((pack) => [pack, { easy: 0, normal: 0, sharp: 0 }]),
      );
      let maxStateBytes = 0;
      let events = 0;
      for (let seed = 1; seed <= RUNS; seed++) {
        // Every eighteen-seed cycle covers all pack/skill pairs, avoiding the six/three coupling.
        const skill = (['easy', 'normal', 'sharp'] as const)[
          Math.floor((seed - 1) / CLASSIC_PACK_IDS.length) % 3
        ]!;
        const pack = CLASSIC_PACK_IDS[(seed - 1) % CLASSIC_PACK_IDS.length]!;
        const run = simulateGroup(count, seed, mode, skill);
        const result = game.results(run.state);
        expect(result, `${mode} seed ${seed}`).not.toBeNull();
        expect(result!.ranking).toHaveLength(count);
        expect(new Set(result!.ranking.map((row) => row.playerId)).size).toBe(count);
        expect(Object.keys(result!.scores)).toHaveLength(count);
        expect(
          Object.values(result!.scores).every((score) => Number.isFinite(score) && score >= 0),
        ).toBe(true);
        expect(
          result!.ranking.every(
            (row) => Number.isInteger(row.rank) && row.rank >= 1 && Number.isFinite(row.score),
          ),
        ).toBe(true);
        const expectedRounds = Math.min(10, CLASSIC_PACKS[pack].questions.length);
        expect(run.state.questionIds).toHaveLength(expectedRounds);
        expect(new Set(run.state.questionIds).size).toBe(expectedRounds);
        expect(run.rounds).toHaveLength(expectedRounds);
        expect(
          run.rounds.every(
            (duration) =>
              Number.isFinite(duration) && duration >= (run.state.settings.talkSeconds ?? 5) * 1000,
          ),
        ).toBe(true);
        expect(run.elapsed).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 120_000);
        expect(run.maxStateBytes).toBeLessThan(256 * 1024);
        const teams = groupStandings(run.state);
        expect(teams).toHaveLength(
          mode === 'tv-vote' ? 1 : Math.min(count, run.state.settings.teamCount ?? 2),
        );
        for (const team of teams) {
          expect(Number.isFinite(team.score) && team.score >= 0).toBe(true);
          for (const member of team.members) expect(result!.scores[member]).toBe(team.score);
        }
        lengths.push(run.elapsed);
        rounds.push(...run.rounds);
        strengths[skill].matches++;
        strengths[skill].elapsedMs += run.elapsed;
        packs[pack] = (packs[pack] ?? 0) + 1;
        packStrengths[pack]![skill]++;
        maxStateBytes = Math.max(maxStateBytes, run.maxStateBytes);
        events += run.events;
      }
      if (process.env.P02_WRITE_EVIDENCE === '1') {
        const media = resolve(import.meta.dirname, '../../../jobs/P02-quiz-rush-teams/media');
        mkdirSync(media, { recursive: true });
        writeFileSync(
          resolve(media, `sim-${mode}-${count}.json`),
          JSON.stringify(
            {
              mode,
              players: count,
              matches: RUNS,
              requiredMatches: 1000,
              completeRequiredCampaign: RUNS === 1000,
              seeds: `1..${RUNS}`,
              medianRoundMs: median(rounds),
              medianMatchMs: median(lengths),
              longestMatchMs: Math.max(...lengths),
              maxStateBytes,
              events,
              strengths,
              packs,
              packStrengths,
              estimateLimitMs: game.manifest.estimatedMinutes * 120_000,
              measurement:
                'Round = discussion + used answer window + reveal/standings; match also includes intro and occupied podium tiers.',
              settings:
                'Manifest defaults; six packs rotate per seed, strengths rotate after every six seeds so each eighteen-seed cycle covers every pack/skill pair; variable custom draw is min(requested default10, pack length); every third room phone-only.',
            },
            null,
            2,
          ) + '\n',
          'utf8',
        );
      }
    }, 600_000);
  });

  it('never invents repeated custom questions when the owner requests more than the compiled pack contains', () => {
    for (const count of [2, 4, 8])
      for (const questions of [5, 10, 20]) {
        const run = simulateGroup(count, 120 + questions + count, mode, 'sharp', {
          classicPack: 'custom',
          questions,
        });
        const expected = Math.min(questions, CLASSIC_PACKS.custom.questions.length);
        expect(run.rounds).toHaveLength(expected);
        expect(new Set(run.state.questionIds).size).toBe(expected);
        expect(run.state.questionIds.every((id) => id.startsWith('custom-'))).toBe(true);
        expect(game.results(run.state)?.ranking).toHaveLength(count);
      }
  });
});
