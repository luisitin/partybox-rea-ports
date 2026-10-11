import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';
import { T0 } from './helpers';

export interface Simulation {
  elapsedMs: number;
  turnLengths: number[];
  totalScore: number;
  guesses: number;
  solved: number;
  turns: number;
  state: State;
}

/** Engine-like fixed reactions, with one current timer fired before inputs at that instant. */
export function simulate(
  count: number,
  seed: number,
  skill: BotSkill,
  laps = 1,
  drawSeconds = 60,
): Simulation {
  const players = testPlayers(count, { bots: count });
  const rng = createRng(seed ^ 0x04da7);
  let state = game.init({
    players,
    settings: { laps, drawSeconds, difficulty: 'easy' },
    seed,
    now: T0,
  });
  let now = T0;
  let guesses = 0;
  let solved = 0;
  let turns = 0;
  const turnLengths: number[] = [];
  const budget = game.manifest.estimatedMinutes * 2 * 60_000;
  let events = 0;
  while (state.phase.id !== 'done' && now - T0 <= budget && events < 20_000) {
    now += 1000;
    if (state.phase.deadline !== null && now >= state.phase.deadline) {
      const before = state;
      state = game.reduce(state, {
        type: 'timer',
        now,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      events++;
      if (before.phase.id === 'draw' && state.phase.id === 'reveal') {
        turnLengths.push(state.phase.startedAt - before.began);
        solved += Object.keys(state.solved).length;
        turns++;
      }
    }
    for (const player of rng.shuffle(players)) {
      const input = game.bot.sampleInput(state, player.id, rng, skill);
      if (!input) continue;
      if (!game.inputSchema.safeParse(input).success)
        throw new Error(`invalid bot input: ${JSON.stringify(input)}`);
      const before = state;
      if (input.type === 'guess') guesses++;
      state = game.reduce(state, { type: 'input', now, playerId: player.id, input });
      events++;
      if (before.phase.id === 'draw' && state.phase.id === 'reveal') {
        turnLengths.push(state.phase.startedAt - before.began);
        solved += Object.keys(state.solved).length;
        turns++;
      }
    }
  }
  if (state.phase.id !== 'done' || game.results(state) === null)
    throw new Error(
      `stuck: count=${count} seed=${seed} skill=${skill} phase=${state.phase.id} elapsed=${now - T0} events=${events}`,
    );
  if (now - T0 > budget) throw new Error(`exceeded estimate x2: ${count}/${seed}/${skill}`);
  return {
    elapsedMs: now - T0,
    turnLengths,
    totalScore: Object.values(state.scores).reduce((n, score) => n + score, 0),
    guesses,
    solved,
    turns,
    state,
  };
}
