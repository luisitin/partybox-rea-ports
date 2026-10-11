import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';

const metrics: Record<string, unknown> = {};
const T0 = 1_000_000;
const count = Number(process.env['PB_SIM_GAMES'] ?? 1000);
if (!Number.isInteger(count) || count < 1 || count > 1000)
  throw new Error('PB_SIM_GAMES must be an integer from 1 to 1000');

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
  botMs: number;
  reducerMs: number;
} {
  const rng = createRng(seed);
  const players = testPlayers(n, { bots: n });
  const kit = testKit(game, { players, t0: T0 });
  let state = kit.start({ seed, settings: { rounds: 1 } });
  let now = T0;
  let events = 0;
  let nextDecision = T0;
  let botMs = 0;
  let reducerMs = 0;
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
      const botStarted = performance.now();
      const input = game.bot.sampleInput(state, player.id, rng, skill);
      botMs += performance.now() - botStarted;
      if (input === null) continue;
      const parsed = game.inputSchema.safeParse(input);
      if (!parsed.success)
        throw new Error(`n=${n}, seed=${seed}: invalid bot input ${JSON.stringify(input)}`);
      const inputStarted = performance.now();
      state = kit.input(state, player.id, parsed.data, inputAt);
      reducerMs += performance.now() - inputStarted;
      events++;
    }
    if (inputAt >= nextDecision) nextDecision = inputAt + 600;
    now = Math.max(inputAt, deadline);
    const timerStarted = performance.now();
    state = kit.timer(state, now);
    reducerMs += performance.now() - timerStarted;
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
    botMs,
    reducerMs,
  };
}

describe('1000 seeded bot games at each party size', () => {
  it.each([2, 4, 8])(
    '%i bots terminate within the manifest estimate × 2',
    (n) => {
      const lengths: number[] = [];
      let maximumGameMs = 0;
      let maximumEvents = 0;
      let botMs = 0;
      let reducerMs = 0;
      const started = performance.now();
      const bySkill = Object.fromEntries(
        (['easy', 'normal', 'sharp'] as const).map((skill) => [
          skill,
          { games: 0, areas: [] as number[], captures: [] as number[], deaths: [] as number[] },
        ]),
      ) as Record<
        BotSkill,
        { games: number; areas: number[]; captures: number[]; deaths: number[] }
      >;
      for (let seed = 1; seed <= count; seed++) {
        const skill = (['easy', 'normal', 'sharp'] as const)[(seed - 1) % 3]!;
        const run = simulate(n, seed, skill);
        lengths.push(...run.playLengths);
        maximumGameMs = Math.max(maximumGameMs, run.milliseconds);
        maximumEvents = Math.max(maximumEvents, run.events);
        botMs += run.botMs;
        reducerMs += run.reducerMs;
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
      expect(lengths.length).toBeGreaterThanOrEqual(count);
      expect(maximumGameMs).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 2 * 60_000);
      expect(medianRoundMs).toBeGreaterThan(0);
      metrics[String(n)] = {
        games: count,
        seeds: `1..${count}`,
        strengths: ['easy', 'normal', 'sharp'],
        medianRoundMs,
        maximumRoundMs: Math.max(...lengths),
        maximumGameMs,
        maximumEvents,
        decisionBeatMs: 600,
        wallMs: performance.now() - started,
        botMs,
        reducerMs,
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
      for (const [skill, values] of Object.entries(bySkill)) {
        if (values.games > 0)
          expect(
            values.captures.some((capture) => capture > 0),
            `${n} players, ${skill} bots capture territory`,
          ).toBe(true);
      }
    },
    180_000,
  );
});
