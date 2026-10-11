import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import type { BotSkill, GameEvent } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Input, State } from '../server/types';
import { T0 } from './helpers';

const metrics: Record<string, unknown> = {};

interface Run {
  milliseconds: number;
  drawLengths: number[];
  events: number;
}

function simulate(n: number, seed: number, skill: BotSkill): Run {
  const rng = createRng(seed);
  const players = testPlayers(n, { bots: n });
  let state = game.init({ players, settings: { rounds: 1 }, seed, now: T0 });
  const budget = game.manifest.estimatedMinutes * 2 * 60_000;
  let now = T0;
  let beat = now + rng.int(700, 1500);
  let events = 0;
  const drawLengths: number[] = [];
  const apply = (event: GameEvent<Input>): void => {
    const prior = state;
    state = game.reduce(state, event);
    events++;
    if (prior.phase.id === 'draw' && state.phase.id !== 'draw')
      drawLengths.push(event.now - prior.began);
  };
  while (game.results(state) === null) {
    if (events > 8000 || now - T0 > budget)
      throw new Error(
        `n=${n}, seed=${seed}, skill=${skill}: stuck in ${state.phase.id}, ${events} events, ${now - T0} ms`,
      );
    const deadline = state.phase.deadline;
    if (deadline !== null && deadline <= beat) {
      now = Math.max(now, deadline);
      apply({ type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt });
      continue;
    }
    now = beat;
    beat = now + rng.int(700, 1500);
    for (const player of rng.shuffle(players)) {
      if (game.results(state) !== null) break;
      const input = game.bot.sampleInput(state, player.id, rng, skill);
      if (input === null) continue;
      const parsed = game.inputSchema.safeParse(input);
      if (!parsed.success)
        throw new Error(
          `n=${n}, seed=${seed}, skill=${skill}: invalid bot input ${JSON.stringify(input)}`,
        );
      apply({ type: 'input', now, playerId: player.id, input: parsed.data });
    }
  }
  const results = game.results(state)!;
  if (
    results.ranking.length !== n ||
    Object.values(results.scores).some((score) => !Number.isFinite(score))
  )
    throw new Error(`n=${n}, seed=${seed}: incomplete results`);
  if (drawLengths.length !== n)
    throw new Error(`n=${n}, seed=${seed}: expected ${n} artists, played ${drawLengths.length}`);
  if (now - T0 > budget) throw new Error(`n=${n}, seed=${seed}: exceeded estimatedMinutes × 2`);
  return { milliseconds: now - T0, drawLengths, events };
}

describe('1000 seeded bot games at each party size', () => {
  it.each([2, 4, 8])(
    '%i bots terminate within the manifest estimate × 2',
    (n) => {
      const lengths: number[] = [];
      let maxGame = 0;
      let maxEvents = 0;
      for (let seed = 1; seed <= 1000; seed++) {
        const skill = (['easy', 'normal', 'sharp'] as const)[(seed - 1) % 3]!;
        const run = simulate(n, seed, skill);
        lengths.push(...run.drawLengths);
        maxGame = Math.max(maxGame, run.milliseconds);
        maxEvents = Math.max(maxEvents, run.events);
      }
      lengths.sort((a, b) => a - b);
      const median =
        (lengths[Math.floor((lengths.length - 1) / 2)]! +
          lengths[Math.floor(lengths.length / 2)]!) /
        2;
      console.log(
        `P04 SIM n=${n}: 1000 seeds (1..1000), strengths easy/normal/sharp; median drawing=${median}ms, max match=${maxGame}ms, max events=${maxEvents}.`,
      );
      expect(lengths).toHaveLength(n * 1000);
      expect(Math.max(...lengths)).toBeLessThanOrEqual(60_000);
      expect(maxGame).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 2 * 60_000);
      expect(median).toBeGreaterThan(0);
      metrics[String(n)] = {
        games: 1000,
        seeds: '1..1000',
        strengths: ['easy', 'normal', 'sharp'],
        medianDrawingMs: median,
        maximumDrawingMs: Math.max(...lengths),
        maximumGameMs: maxGame,
        maximumEvents: maxEvents,
        budgetMs: game.manifest.estimatedMinutes * 2 * 60_000,
      };
      if (process.env['PB_RECORD_VERIFY'] === '1')
        writeFileSync(
          resolve('jobs/P04-draw-and-guess/tools/simulation-results.json'),
          JSON.stringify(metrics, null, 2) + '\n',
          'utf8',
        );
    },
    180_000,
  );
});
