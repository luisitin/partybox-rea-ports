// Adds 14,000 new-mode matches; simulation.test.ts retains the 7,000 original solo matches.
import { writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { GROUP_MODES, median, NEW_PACKS, simulateTeamMatch, STRENGTHS } from './test-team-sim';

type Evidence = {
  mode: string;
  players: number;
  matches: number;
  completed: number;
  medianRoundMs: number;
  medianAnswerMs: number;
  medianTapMs: number;
  maxMatchMs: number;
  strengths: Record<string, number>;
  packs: Record<string, number>;
  maximumSettingsMatches: number;
  maximumTwentyQuestionMatches: number;
};
const evidence: Evidence[] = [];

afterAll(() => {
  if (process.env.WRITE_P02_EVIDENCE !== '1') return;
  writeFileSync(
    'jobs/P02-quiz-rush-teams/simulation-results.json',
    JSON.stringify(
      {
        newModeMatches: evidence.reduce((sum, row) => sum + row.matches, 0),
        inheritedSoloSuite: 'games/kahoot/__tests__/simulation.test.ts (7,000 additional matches)',
        estimateMs: game.manifest.estimatedMinutes * 60_000,
        limitMs: game.manifest.estimatedMinutes * 120_000,
        scheduling: 'SDK phase deadlines; bots sampled only during the answer phase',
        records: evidence,
      },
      null,
      2,
    ) + '\n',
  );
});

describe('new group modes: 1,000 seeded matches at every supported player count', () => {
  for (const mode of GROUP_MODES)
    for (const players of [2, 3, 4, 5, 6, 7, 8]) {
      it(`${mode}: ${players} bots finish with every starter below estimate × 2`, () => {
        const rounds: number[] = [];
        const answers: number[] = [];
        const taps: number[] = [];
        const strengths = Object.fromEntries(STRENGTHS.map((key) => [key, 0]));
        const packs = Object.fromEntries(NEW_PACKS.map((key) => [key, 0]));
        let maxMatchMs = 0;
        let maximumSettingsMatches = 0;
        let maximumTwentyQuestionMatches = 0;
        for (let seed = 1; seed <= 1000; seed++) {
          const run = simulateTeamMatch(players, seed, mode);
          const state = run.state;
          expect(state.phase.id).toBe('done');
          expect(run.events).toBeLessThan(4000);
          expect(run.elapsed).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 120_000);
          expect(run.closedRounds).toBe(state.deck.length);
          expect(run.answerMs).toHaveLength(state.deck.length);
          expect(run.roundMs.every((ms) => Number.isFinite(ms) && ms > 0)).toBe(true);
          expect(run.answerMs.every((ms) => Number.isFinite(ms) && ms > 0)).toBe(true);
          const result = game.results(state)!;
          const starters = Array.from({ length: players }, (_, index) => `p${index + 1}`).sort();
          expect(result.ranking.map((row) => row.playerId).sort()).toEqual(starters);
          expect(state.teams.flatMap((team) => team.members).sort()).toEqual(starters);
          expect(result.winnerIds.slice().sort()).toEqual(
            result.ranking
              .filter((row) => row.rank === 1)
              .map((row) => row.playerId)
              .sort(),
          );
          expect(
            Object.values(state.scores).every((score) => Number.isInteger(score) && score >= 0),
          ).toBe(true);
          for (const team of state.teams)
            expect(team.members.every((id) => state.scores[id] === state.teamScores[team.id])).toBe(
              true,
            );
          if (mode === 'tv-vote') expect(state.teams).toHaveLength(1);
          else {
            expect(state.teams).toHaveLength(Math.min(players, state.settings.teamCount));
            const sizes = state.teams.map((team) => team.members.length);
            expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
          }
          strengths[run.strength]!++;
          packs[run.pack]!++;
          maximumSettingsMatches += Number(run.maximum);
          maximumTwentyQuestionMatches += Number(run.maximum && state.deck.length === 20);
          if (run.maximum) {
            expect(state.settings.seconds).toBe(30);
            expect(state.settings.talkSeconds).toBe(20);
            expect(state.settings.teamCount).toBe(Math.min(players, 4));
            expect(state.deck.length).toBe(run.pack === 'custom' ? 5 : 20);
          }
          rounds.push(...run.roundMs);
          answers.push(...run.answerMs);
          taps.push(...run.tapMs);
          maxMatchMs = Math.max(maxMatchMs, run.elapsed);
        }
        expect(Object.values(strengths).every((count) => count >= 330)).toBe(true);
        expect(Object.values(packs).every((count) => count >= 330)).toBe(true);
        expect(maximumSettingsMatches).toBe(100);
        expect(maximumTwentyQuestionMatches).toBeGreaterThanOrEqual(66);
        const row = {
          mode,
          players,
          matches: 1000,
          completed: 1000,
          medianRoundMs: median(rounds),
          medianAnswerMs: median(answers),
          medianTapMs: median(taps),
          maxMatchMs,
          strengths,
          packs,
          maximumSettingsMatches,
          maximumTwentyQuestionMatches,
        };
        evidence.push(row);
        console.log(
          `Kahoot! ${mode}, ${players} players: 1000/1000 done; median round ${row.medianRoundMs} ms; median answer ${row.medianAnswerMs} ms; maximum match ${maxMatchMs} ms`,
        );
      }, 60_000);
    }
});
