import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';

export interface MatchRun {
  milliseconds: number;
  roundMilliseconds: number;
  events: number;
  state: State;
}

// Drive every seat once per heartbeat, then fire the current timer. This models
// simultaneous phone input and never suppresses gravity through input spam.
export function botMatch(players: number, seed: number): MatchRun {
  const skill = (['easy', 'normal', 'sharp'] as const)[seed % 3]!;
  const rng = createRng(seed);
  const began = 1_000_000;
  let state = game.init({
    players: testPlayers(players, { bots: players }),
    settings: {},
    seed,
    now: began,
    ...(skill === 'normal' ? {} : { botSkill: skill }),
  });
  let now = began;
  let events = 0;
  const budget = game.manifest.estimatedMinutes * 2 * 60_000;
  while (game.results(state) === null && events < 20_000 && now - began <= budget) {
    const deadline = state.phase.deadline;
    if (deadline === null) throw new Error(`Seed ${seed}: no deadline in ${state.phase.id}`);
    now = Math.max(now, deadline - 1);
    for (const player of state.boards.map((board) => board.id)) {
      const input = game.bot.sampleInput(state, player, rng, skill);
      if (input === null) continue;
      const parsed = game.inputSchema.safeParse(input);
      if (!parsed.success) throw new Error(`Seed ${seed}: invalid ${skill} bot input`);
      state = game.reduce(state, { type: 'input', now, playerId: player, input: parsed.data });
      events++;
      if (game.results(state) !== null) break;
    }
    if (game.results(state) !== null) break;
    now = Math.max(now, state.phase.deadline ?? now);
    state = game.reduce(state, {
      type: 'timer',
      now,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
    events++;
  }
  if (game.results(state) === null) {
    throw new Error(
      `${players} players, seed ${seed}: stuck after ${events} events / ${now - began}ms`,
    );
  }
  if (now - began > budget) throw new Error(`Seed ${seed}: exceeded ${budget}ms budget`);
  return {
    milliseconds: now - began,
    roundMilliseconds: state.checked - state.began,
    events,
    state,
  };
}

export function botBatch(players: number, runs = 1000) {
  const lengths: number[] = [];
  const roundLengths: number[] = [];
  let maxEvents = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const match = botMatch(players, seed);
    lengths.push(match.milliseconds);
    roundLengths.push(match.roundMilliseconds);
    maxEvents = Math.max(maxEvents, match.events);
    const result = game.results(match.state)!;
    if (Object.keys(result.scores).length !== players || result.ranking.length !== players) {
      throw new Error(`${players} players, seed ${seed}: lost a score or ranking entry`);
    }
  }
  lengths.sort((a, b) => a - b);
  roundLengths.sort((a, b) => a - b);
  const mid = Math.floor(lengths.length / 2);
  const medianMs = lengths.length % 2 ? lengths[mid]! : (lengths[mid - 1]! + lengths[mid]!) / 2;
  const medianRoundMs =
    roundLengths.length % 2
      ? roundLengths[mid]!
      : (roundLengths[mid - 1]! + roundLengths[mid]!) / 2;
  return {
    players,
    runs,
    seedFirst: 1,
    seedLast: runs,
    medianMs,
    medianRoundMs,
    maximumMs: lengths.at(-1)!,
    maximumRoundMs: roundLengths.at(-1)!,
    maxEvents,
  };
}
