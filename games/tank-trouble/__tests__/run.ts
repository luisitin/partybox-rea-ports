// A bounded seeded engine model. Only this game's tests call it; no browser or network.
import { createRng } from '@partybox/game-sdk';
import type { BotSkill } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';

export const T0 = 1_700_000_000_000;

export interface Simulation {
  state: State;
  elapsed: number;
  events: number;
  roundMs: number[];
  fixtures: Record<string, State>;
}

export function simulate(
  count: number,
  seed: number,
  skill: BotSkill = 'normal',
  powerups = true,
): Simulation {
  const players = testPlayers(count, { bots: count });
  const rng = createRng(seed ^ 0x42fb);
  let state = game.init({ players, seed, settings: { powerups }, now: T0 });
  let now = T0;
  let events = 0;
  let roundStart = T0;
  let recordedRound = 0;
  const roundMs: number[] = [];
  const fixtures: Record<string, State> = { [state.phase.id]: state };
  const capture = (): void => {
    fixtures[state.phase.id] ??= state;
    if (state.phase.id === 'play' && now - state.phase.startedAt > 2000) fixtures.play = state;
    if (state.phase.id === 'ready' && state.round > recordedRound) roundStart = now;
    if (state.phase.id === 'score' && state.round > recordedRound) {
      recordedRound = state.round;
      roundMs.push(now - roundStart);
      if (state.round === 5) fixtures['score-last'] = state;
    }
  };
  while (game.results(state) === null) {
    if (++events > 20_000 || now - T0 > game.manifest.estimatedMinutes * 120_000)
      throw new Error(`Run exhausted seed=${seed}, count=${count}, phase=${state.phase.id}`);
    const deadline = state.phase.deadline;
    if (deadline === null) throw new Error(`Nonterminal phase has no deadline: ${state.phase.id}`);
    // Inputs are delivered immediately before their heartbeat; timers remain authoritative.
    if (state.phase.id === 'play') {
      now = Math.max(now, deadline - 1);
      for (const player of players) {
        const input = game.bot.sampleInput(state, player.id, rng, skill);
        if (input === null) continue;
        const parsed = game.inputSchema.safeParse(input);
        if (!parsed.success) throw new Error(`Invalid bot input: ${JSON.stringify(input)}`);
        const previous = state.phase;
        state = game.reduce(state, { type: 'input', now, playerId: player.id, input });
        events++;
        capture();
        if (state.phase.id !== previous.id || state.phase.startedAt !== previous.startedAt) break;
      }
    }
    if (game.results(state) !== null) break;
    now = Math.max(now, state.phase.deadline ?? now);
    state = game.reduce(state, {
      type: 'timer',
      now,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
    capture();
  }
  return { state, elapsed: now - T0, events, roundMs, fixtures };
}
