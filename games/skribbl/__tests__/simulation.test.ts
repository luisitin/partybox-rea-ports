import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { simulate } from './simulation';

const summaries: {
  players: number;
  skill: string;
  games: number;
  maxElapsedMs: number;
  medianTurnMs: number;
  meanScore: number;
  solvedFraction: number;
}[] = [];
const skills = ['easy', 'normal', 'sharp'] as const;

describe('seeded bot parties', () => {
  // Every legal player count gets 1,000 seeds distributed evenly across all strengths.
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'terminates 1,000 distributed strength seeds with %i players',
    (players) => {
      for (const skill of skills) {
        const lengths: number[] = [];
        let maxElapsedMs = 0;
        let scores = 0;
        let solved = 0;
        let possible = 0;
        let games = 0;
        for (let seed = 1; seed <= 1000; seed++) {
          if (skills[(seed - 1) % 3] !== skill) continue;
          games++;
          const run = simulate(players, seed, skill);
          maxElapsedMs = Math.max(maxElapsedMs, run.elapsedMs);
          lengths.push(...run.turnLengths);
          scores += run.totalScore;
          solved += run.solved;
          possible += run.turns * (players - 1);
          if (run.turns !== players)
            throw new Error(`wrong rotation count: ${players}/${seed}/${skill}: ${run.turns}`);
          if (Object.keys(game.results(run.state)!.scores).length !== players)
            throw new Error('incomplete results');
        }
        lengths.sort((a, b) => a - b);
        const medianTurnMs = lengths[Math.floor(lengths.length / 2)]!;
        const summary = {
          players,
          skill,
          games,
          maxElapsedMs,
          medianTurnMs,
          meanScore: scores / games,
          solvedFraction: solved / Math.max(1, possible),
        };
        summaries.push(summary);
        console.log(`SIM ${JSON.stringify(summary)}`);
        expect(maxElapsedMs).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 2 * 60_000);
        expect(medianTurnMs).toBeGreaterThan(0);
        expect(medianTurnMs).toBeLessThanOrEqual(60_000);
      }
    },
    120_000,
  );

  it('two laps at the maximum drawing time also stay within the manifest budget', () => {
    for (const players of [2, 4, 8])
      for (const skill of skills) {
        const run = simulate(players, 777, skill, 2, 60);
        expect(run.turns).toBe(players * 2);
        expect(run.elapsedMs).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 2 * 60_000);
      }
  });

  it('strengths differ in recognition, speed and points across the seeded corpus', () => {
    const total = (skill: string): number =>
      summaries.filter((s) => s.skill === skill).reduce((n, s) => n + s.solvedFraction, 0);
    expect(total('normal')).toBeGreaterThanOrEqual(total('easy'));
    expect(total('sharp')).toBeGreaterThanOrEqual(total('normal'));
    const points = (skill: string): number =>
      summaries.filter((s) => s.skill === skill).reduce((n, s) => n + s.meanScore, 0);
    expect(points('normal')).toBeGreaterThan(points('easy'));
    expect(points('sharp')).toBeGreaterThan(points('normal'));
    const medianSum = (skill: string): number =>
      summaries.filter((s) => s.skill === skill).reduce((n, s) => n + s.medianTurnMs, 0);
    expect(medianSum('normal')).toBeLessThan(medianSum('easy'));
    expect(medianSum('sharp')).toBeLessThan(medianSum('normal'));
  });
});

afterAll(() => {
  if (process.env['WRITE_EVIDENCE'] !== '1') return;
  const dir = fileURLToPath(new URL('../../../jobs/P04-draw-and-guess/tools/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/simulation-results.json`,
    `${JSON.stringify({ seeds: '1..1000', strengthAssignment: '(seed - 1) % 3 => easy, normal, sharp', totalGames: 7000, settings: { laps: 1, drawSeconds: 60, difficulty: 'easy' }, summaries }, null, 2)}\n`,
    'utf8',
  );
});
