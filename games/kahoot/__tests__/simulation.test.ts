// CPU-light server simulations: 1000 matches at every supported player count, three bot strengths.
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Input, State } from '../server/types';

export function simulate(
  n: number,
  seed: number,
): { state: State; elapsed: number; rounds: number[] } {
  const rng = createRng(seed);
  const skill = (['easy', 'normal', 'sharp'] as const)[seed % 3]!;
  let state = game.init({
    players: testPlayers(n, { bots: n }),
    settings: {
      pack: ['general', 'movies', 'science'][seed % 3]!,
      rounds: seed % 10 === 0 ? 20 : 10,
    },
    seed,
    now: 0,
  });
  let now = 0;
  let begun = 0;
  const rounds: number[] = [];
  for (let event = 0; event < 2000 && state.phase.id !== 'done'; event++) {
    if (state.phase.id === 'question') {
      now = Math.min(state.phase.deadline!, now + rng.int(300, 1200));
      if (now < state.phase.deadline!) {
        for (const p of rng.shuffle(Object.values(state.players))) {
          const input: Input | null = game.bot.sampleInput(state, p.id, rng, skill);
          if (input) {
            if (!game.inputSchema.safeParse(input).success) throw new Error('Invalid bot input');
            state = game.reduce(state, { type: 'input', playerId: p.id, now, input });
          }
          if (state.phase.id !== 'question') break;
        }
      }
      if (state.phase.id === 'question' && now === state.phase.deadline)
        state = game.reduce(state, {
          type: 'timer',
          now,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt,
        });
    } else {
      now = state.phase.deadline!;
      state = game.reduce(state, {
        type: 'timer',
        now,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      if (state.phase.id === 'question') {
        rounds.push(now - begun);
        begun = now;
      }
    }
  }
  rounds.push(now - begun);
  return { state, elapsed: now, rounds };
}

describe('1000 seeded matches per player count', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8])
    it(`${n} bots terminate below estimate × 2`, () => {
      const lengths: number[] = [];
      let max = 0;
      for (let seed = 1; seed <= 1000; seed++) {
        const run = simulate(n, seed);
        expect(run.state.phase.id).toBe('done');
        expect(run.elapsed).toBeLessThanOrEqual(game.manifest.estimatedMinutes * 120_000);
        expect(game.results(run.state)!.ranking).toHaveLength(n);
        expect(Object.values(run.state.scores).every(Number.isFinite)).toBe(true);
        max = Math.max(max, run.elapsed);
        lengths.push(...run.rounds);
      }
      lengths.sort((a, b) => a - b);
      const median = lengths[Math.floor(lengths.length / 2)]!;
      console.log(
        `Quiz Rush ${n} players: 1000/1000 done, median round ${median} ms, maximum match ${max} ms`,
      );
      if (process.env.PB_WRITE_EVIDENCE === '1')
        writeFileSync(
          `jobs/P01-quiz-rush/sim-${n}.json`,
          JSON.stringify(
            {
              players: n,
              matches: 1000,
              medianRoundMs: median,
              maxMatchMs: max,
              skills: ['easy', 'normal', 'sharp'],
            },
            null,
            2,
          ) + '\n',
        );
    }, 60_000);
});
