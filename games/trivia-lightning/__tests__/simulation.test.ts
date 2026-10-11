// 21,000 seeded games: every supported roster and each bot strength, with independent virtual clocks.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { BotSkill } from '@partybox/game-sdk';
import { game } from '../server/index';
import { DECISION_MS, simulate } from './simulation-helper';

const SEEDS = 1000;
const skills = ['easy', 'normal', 'sharp'] as const;
const counts = [2, 3, 4, 5, 6, 7, 8] as const;
const groups = counts.flatMap((count) => skills.map((skill) => [count, skill] as const));
interface Summary {
  players: number;
  skill: BotSkill;
  samples: number;
  seedFirst: number;
  seedLast: number;
  medianRaceMs: number;
  maxRaceMs: number;
  medianMatchMs: number;
  maxMatchMs: number;
  answered: number;
  correct: number;
  accuracy: number;
  finishedPlayers: number;
  doubleUses: number;
  freezeUses: number;
}
const summaries: Summary[] = [];
const median = (values: number[]): number => {
  values.sort((a, b) => a - b);
  return (values[values.length / 2 - 1]! + values[values.length / 2]!) / 2;
};

describe('seeded bot parties', () => {
  it.each(groups)(
    '%i players / %s: 1,000 games terminate within two estimates',
    (count, skill) => {
      const raceLengths: number[] = [];
      const matchLengths: number[] = [];
      let answered = 0;
      let correct = 0;
      let finishedPlayers = 0;
      let doubleUses = 0;
      let freezeUses = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const run = simulate(count, seed, skill);
        const result = game.results(run.final);
        if (!result || result.ranking.length !== count || run.final.phase.id !== 'done')
          throw new Error(
            `Missing terminal roster: players=${count}, seed=${seed}, skill=${skill}`,
          );
        if (result.ranking.some((r) => !Number.isFinite(r.score) || r.score < 0))
          throw new Error(`Invalid result score: seed=${seed}`);
        if (run.raceMs > run.final.cfg.seconds * 1000)
          throw new Error(`Race exceeded its cap: seed=${seed}`);
        raceLengths.push(run.raceMs);
        matchLengths.push(run.matchMs);
        for (const runner of Object.values(run.final.runners)) {
          answered += runner.answered;
          correct += runner.correct;
        }
        finishedPlayers += run.finishedPlayers;
        doubleUses += run.doubleUses;
        freezeUses += run.freezeUses;
      }
      const summary: Summary = {
        players: count,
        skill,
        samples: SEEDS,
        seedFirst: 1,
        seedLast: SEEDS,
        medianRaceMs: median(raceLengths),
        maxRaceMs: Math.max(...raceLengths),
        medianMatchMs: median(matchLengths),
        maxMatchMs: Math.max(...matchLengths),
        answered,
        correct,
        accuracy: correct / answered,
        finishedPlayers,
        doubleUses,
        freezeUses,
      };
      summaries.push(summary);
      expect(summary.maxMatchMs).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 2 * 60_000);
      expect(summary.finishedPlayers).toBeGreaterThan(SEEDS * count * 0.95);
      expect(summary.doubleUses).toBeGreaterThan(0);
      if (skill === 'sharp') expect(summary.freezeUses).toBeGreaterThan(0);
      console.log(JSON.stringify(summary));
    },
    60_000,
  );
});

afterAll(() => {
  // Small aggregate evidence, not 21,000 state dumps; sorted so reruns produce a stable file.
  summaries.sort(
    (a, b) => a.players - b.players || skills.indexOf(a.skill) - skills.indexOf(b.skill),
  );
  const path = resolve('jobs/P03-trivia-lightning/media');
  mkdirSync(path, { recursive: true });
  writeFileSync(
    resolve(path, 'simulation.json'),
    `${JSON.stringify(
      {
        protocol: '1,000 seeded bot games for each of 2–8 players and easy/normal/sharp',
        completedGroups: summaries.length,
        totalGames: summaries.reduce((n, group) => n + group.samples, 0),
        decisionMs: DECISION_MS,
        settings: { questions: 12, seconds: 90, powers: true },
        maxBudgetMs: game.manifest.estimatedMinutes * 2 * 60_000,
        groups: summaries,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
});
