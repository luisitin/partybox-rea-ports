// A virtual-clock engine driver: each bot gets its own seeded next decision, including after a refusal.
import { createRng } from '@partybox/game-sdk';
import type { BotSkill, GameEvent, Settings } from '@partybox/game-sdk';
import { T0, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Input, State } from '../server/types';

export const DECISION_MS: Record<BotSkill, readonly [number, number]> = {
  easy: [1000, 2200],
  normal: [900, 1800],
  sharp: [650, 1300],
};

export interface SimulationResult {
  final: State;
  raceMs: number;
  matchMs: number;
  events: number;
  doubleUses: number;
  freezeUses: number;
  finishedPlayers: number;
}

export function simulate(
  count: number,
  seed: number,
  skill: BotSkill,
  settings: Settings = {},
): SimulationResult {
  const players = testPlayers(count, { bots: count });
  const rng = createRng(seed);
  const [minMs, maxMs] = DECISION_MS[skill];
  let state = game.init({ players, seed, settings, now: T0 });
  const decisions = players.map(() => T0 + rng.int(minMs, maxMs));
  let now = T0;
  let events = 0;
  let raceMs = 0;
  let doubleUses = 0;
  let freezeUses = 0;
  const budget = game.manifest.estimatedMinutes * 2 * 60_000;

  const apply = (event: GameEvent<Input>): void => {
    const before = state;
    state = game.reduce(state, event);
    events += 1;
    if (before.phase.id === 'race' && state.phase.id !== 'race') raceMs = now - T0;
    if (state !== before && event.type === 'input' && event.input.type === 'power') {
      if (event.input.power === 'double') doubleUses += 1;
      else freezeUses += 1;
    }
  };

  while (game.results(state) === null) {
    if (events >= 10_000 || now - T0 > budget || state.phase.deadline === null)
      throw new Error(`Stuck simulation: count=${count}, seed=${seed}, skill=${skill}`);
    const deadline = state.phase.deadline;
    now = state.phase.id === 'race' ? Math.min(deadline, ...decisions) : deadline;
    if (deadline <= now) {
      apply({
        type: 'timer',
        now,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
    }
    for (let i = 0; i < players.length && state.phase.id === 'race'; i++) {
      if (decisions[i]! > now) continue;
      const player = players[i]!;
      const input = game.bot.sampleInput(state, player.id, rng, skill);
      if (input !== null) {
        if (!game.inputSchema.safeParse(input).success)
          throw new Error(`Invalid bot input: seed=${seed}, skill=${skill}`);
        apply({ type: 'input', now, playerId: player.id, input });
      }
      // A frozen bot returning null must get another decision after the freeze expires.
      decisions[i] = now + rng.int(minMs, maxMs);
    }
  }
  if (now - T0 > budget) throw new Error(`Exceeded simulation budget: seed=${seed}`);
  return {
    final: state,
    raceMs,
    matchMs: now - T0,
    events,
    doubleUses,
    freezeUses,
    finishedPlayers: Object.values(state.runners).filter((r) => r.answered === state.deck.length)
      .length,
  };
}
