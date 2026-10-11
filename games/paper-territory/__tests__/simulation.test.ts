import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';

const metrics: Record<string, unknown> = {};
const T0 = 1_000_000;

function simulate(
  n: number,
  seed: number,
  skill: BotSkill,
): {
  milliseconds: number;
  playLengths: number[];
  events: number;
  areas: number[];
  captures: number[];
  deaths: number[];
} {
  const rng = createRng(seed);
  const players = testPlayers(n, { bots: n });
  const kit = testKit(game, { players, t0: T0 });
  let state = kit.start({ seed, settings: { rounds: 1 } });
  let now = T0;
  let events = 0;
  let nextDecision = T0;
  const playLengths: number[] = [];
  const budget = game.manifest.estimatedMinutes * 2 * 60_000;
  while (game.results(state) === null) {
    if (events > 20_000 || now - T0 > budget)
      throw new Error(
        `n=${n}, seed=${seed}, ${skill}: stuck in ${state.phase.id} at ${now - T0}ms after ${events} events`,
      );
    const deadline = state.phase.deadline;
    if (deadline === null)
      throw new Error(`n=${n}, seed=${seed}: nonterminal phase has no deadline`);
    const priorPhase = state.phase.id;
    const began = state.phase.startedAt;
    // Every steering decision arrives before the shared simulation tick. No seat
    // gets a physics step between its input and another seat's input.
    const inputAt = Math.max(now, deadline - 1);
    for (const player of inputAt >= nextDecision ? rng.shuffle(players) : []) {
      const input = game.bot.sampleInput(state, player.id, rng, skill);
      if (input === null) continue;
      const parsed = game.inputSchema.safeParse(input);
      if (!parsed.success)
        throw new Error(`n=${n}, seed=${seed}: invalid bot input ${JSON.stringify(input)}`);
      state = kit.input(state, player.id, parsed.data, inputAt);
      events++;
    }
    if (inputAt >= nextDecision) nextDecision = inputAt + 600;
    now = Math.max(inputAt, deadline);
    state = kit.timer(state, now);
    events++;
    if (priorPhase === 'play' && state.phase.id !== 'play') playLengths.push(now - began);
  }
  const results = game.results(state)!;
  if (
    results.ranking.length !== n ||
    Object.values(results.scores).some((score) => !Number.isFinite(score))
  )
    throw new Error(`n=${n}, seed=${seed}: incomplete or nonfinite results`);
  if (playLengths.length === 0) throw new Error(`n=${n}, seed=${seed}: no round was played`);
  if (now - T0 > budget) throw new Error(`n=${n}, seed=${seed}: exceeded manifest estimate × 2`);
  return {
    milliseconds: now - T0,
    playLengths,
    events,
    areas: state.world.runners.map((r) => r.area),
    captures: state.world.runners.map((r) => r.captures),
    deaths: state.world.runners.map((r) => r.deaths),
  };
}

describe('1000 seeded bot games at each party size', () => {
  it.each([2, 4, 8])(
    '%i bots terminate within the manifest estimate × 2',
    (n) => {
      const lengths: number[] = [];
      let maximumGameMs = 0;
      let maximumEvents = 0;
      const bySkill = Object.fromEntries(
        (['easy', 'normal', 'sharp'] as const).map((skill) => [
          skill,
          { games: 0, areas: [] as number[], captures: [] as number[], deaths: [] as number[] },
        ]),
      ) as Record<
        BotSkill,
        { games: number; areas: number[]; captures: number[]; deaths: number[] }
      >;
      for (let seed = 1; seed <= 1000; seed++) {
        const skill = (['easy', 'normal', 'sharp'] as const)[(seed - 1) % 3]!;
        const run = simulate(n, seed, skill);
        lengths.push(...run.playLengths);
        maximumGameMs = Math.max(maximumGameMs, run.milliseconds);
        maximumEvents = Math.max(maximumEvents, run.events);
        bySkill[skill].games++;
        bySkill[skill].areas.push(...run.areas);
        bySkill[skill].captures.push(...run.captures);
        bySkill[skill].deaths.push(...run.deaths);
      }
      lengths.sort((a, b) => a - b);
      const medianRoundMs =
        (lengths[Math.floor((lengths.length - 1) / 2)]! +
          lengths[Math.floor(lengths.length / 2)]!) /
        2;
      expect(lengths.length).toBeGreaterThanOrEqual(1000);
      expect(maximumGameMs).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 2 * 60_000);
      expect(medianRoundMs).toBeGreaterThan(0);
      metrics[String(n)] = {
        games: 1000,
        seeds: '1..1000',
        strengths: ['easy', 'normal', 'sharp'],
        medianRoundMs,
        maximumRoundMs: Math.max(...lengths),
        maximumGameMs,
        maximumEvents,
        decisionBeatMs: 600,
        bySkill: Object.fromEntries(
          Object.entries(bySkill).map(([skill, values]) => {
            const median = (numbers: number[]): number => {
              const sorted = [...numbers].sort((a, b) => a - b);
              return (
                (sorted[Math.floor((sorted.length - 1) / 2)]! +
                  sorted[Math.floor(sorted.length / 2)]!) /
                2
              );
            };
            const mean = (numbers: number[]): number =>
              numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
            return [
              skill,
              {
                games: values.games,
                players: values.areas.length,
                meanFinalArea: mean(values.areas),
                medianFinalArea: median(values.areas),
                maximumFinalArea: Math.max(...values.areas),
                meanCaptures: mean(values.captures),
                medianCaptures: median(values.captures),
                meanDeaths: mean(values.deaths),
                medianDeaths: median(values.deaths),
                grewBeyondHome: values.areas.filter((area) => area > 9).length,
              },
            ];
          }),
        ),
        budgetMs: game.manifest.estimatedMinutes * 2 * 60_000,
      };
      console.log(`P07 SIM n=${n}: ${JSON.stringify(metrics[String(n)])}`);
      if (process.env['PB_RECORD_VERIFY'] === '1') {
        const dir = resolve('jobs/P07-paper-territory/tools');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          resolve(dir, 'simulation-results.json'),
          JSON.stringify(metrics, null, 2) + '\n',
          'utf8',
        );
      }
    },
    180_000,
  );
});
