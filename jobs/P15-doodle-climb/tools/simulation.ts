import { createRng } from '@partybox/game-sdk';
import type { BotSkill, GameEvent } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../../../games/doodle-climb/server/index';
import type { Input, State } from '../../../games/doodle-climb/server/types';

export interface SimMatch {
  state: State;
  simulatedMs: number;
  roundsMs: number[];
  events: number;
  inputs: number;
  dead: number;
  climberRounds: number;
  heightBySkill: Record<BotSkill, number[]>;
}

/** Sequential timers with honest mixed-skill bot reactions; no engine shortcuts or VIP skips. */
export function simulate(
  players: number,
  seed: number,
  onState?: (state: State) => void,
  reactionMs: readonly [number, number] = [300, 1200],
): SimMatch {
  const rng = createRng(seed ^ 0x15b07);
  const roster = testPlayers(players, { bots: players });
  let state = game.init({ players: roster, settings: {}, seed, now: 1000 });
  let now = 1000;
  let events = 0;
  let inputs = 0;
  const roundsMs: number[] = [];
  const next = roster.map(() => now + rng.int(...reactionMs));
  const skills: BotSkill[] = ['easy', 'normal', 'sharp'];
  const heightBySkill: Record<BotSkill, number[]> = { easy: [], normal: [], sharp: [] };
  let dead = 0;
  let climberRounds = 0;
  const budget = game.manifest.estimatedMinutes * 2 * 60_000;
  const apply = (event: GameEvent<Input>): void => {
    const wasPlay = state.phase.id === 'play';
    state = game.reduce(state, event);
    events++;
    if (wasPlay && state.phase.id !== 'play') {
      roundsMs.push(state.elapsed);
      for (let seat = 0; seat < roster.length; seat++) {
        const c = state.world.climbers[seat]!;
        heightBySkill[skills[(seat + seed) % 3]!].push(Math.floor(c.peak));
        if (c.died !== null) dead++;
        climberRounds++;
      }
    }
    onState?.(state);
  };
  onState?.(state);
  while (game.results(state) === null) {
    if (now - 1000 > budget || events > 30_000)
      throw new Error(`nontermination n=${players} seed=${seed}, phase=${state.phase.id}`);
    const deadline = state.phase.deadline;
    if (deadline === null) throw new Error(`missing timer n=${players} seed=${seed}`);
    now = state.phase.id === 'play' ? Math.min(deadline, ...next) : deadline;
    if (now === deadline)
      apply({ type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt });
    for (let seat = 0; seat < roster.length; seat++) {
      if (next[seat]! > now) continue;
      const id = roster[seat]!.id;
      if (state.phase.id === 'play') {
        const input = game.bot.sampleInput(state, id, rng, skills[(seat + seed) % 3]);
        if (input) {
          if (!game.inputSchema.safeParse(input).success)
            throw new Error(`invalid bot n=${players} seed=${seed} ${id}`);
          apply({ type: 'input', now, playerId: id, input });
          inputs++;
        }
      }
      next[seat] = now + rng.int(...reactionMs);
    }
    // A fresh round begins after a non-playing deadline; no reaction remains in the past.
    for (let seat = 0; seat < next.length; seat++) next[seat] = Math.max(next[seat]!, now + 1);
  }
  const result = game.results(state);
  if (
    result?.ranking.length !== players ||
    Object.values(result.scores).some((n) => !Number.isFinite(n))
  )
    throw new Error(`incomplete result n=${players} seed=${seed}`);
  return {
    state,
    simulatedMs: now - 1000,
    roundsMs,
    events,
    inputs,
    dead,
    climberRounds,
    heightBySkill,
  };
}
