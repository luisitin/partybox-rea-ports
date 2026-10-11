// The engine's 100ms deadlines are also the reaction opportunities; no inputs use future state.
import { createRng } from '../../packages/game-sdk/src/index';
import type { BotSkill, GameEvent } from '../../packages/game-sdk/src/index';
import { testPlayers } from '../../packages/game-sdk/src/testing';
import { game } from '../../games/dino-dash/server/index';
import type { State } from '../../games/dino-dash/server/types';
import type { Input } from '../../games/dino-dash/server/world';

export const T0 = 1_700_000_000_000;
export const BUDGET_MS = game.manifest.estimatedMinutes * 2 * 60_000;
export interface Simulation {
  final: State;
  elapsed: number;
  roundLengths: number[];
  events: number;
}
export function simulateOne(
  count: number,
  seed: number,
  skill: BotSkill,
  onEvent?: (state: State, event: GameEvent<Input>) => void,
): Simulation {
  const players = testPlayers(count, { bots: count });
  const rngs = players.map((_, index) => createRng((seed ^ ((index + 1) * 0x9e3779b9)) >>> 0));
  let state = game.init({ players, seed, now: T0, settings: {} });
  let now = T0;
  let events = 0;
  const roundLengths: number[] = [];
  const reduce = (event: GameEvent<Input>): void => {
    const before = state;
    state = game.reduce(state, event);
    events++;
    if (before.phase.id === 'play' && state.phase.id !== 'play')
      roundLengths.push(state.world.checked);
    onEvent?.(state, event);
  };
  while (state.phase.id !== 'done') {
    if (events > 30_000 || now - T0 > BUDGET_MS)
      throw new Error(
        `Unterminated: count=${count} seed=${seed} skill=${skill} phase=${state.phase.id}`,
      );
    if (state.phase.paused || state.phase.deadline === null)
      throw new Error(`Unexpected untimed phase: ${state.phase.id}`);
    if (state.phase.id === 'play') {
      for (let i = 0; i < players.length; i++) {
        const id = players[i]!.id;
        const input = game.bot.sampleInput(state, id, rngs[i]!, skill);
        if (input === null) continue;
        const parsed = game.inputSchema.safeParse(input);
        if (!parsed.success)
          throw new Error(
            `Invalid bot input: ${count}/${seed}/${skill}/${id}: ${JSON.stringify(input)}`,
          );
        reduce({ type: 'input', now, playerId: id, input: parsed.data });
        if (state.phase.id !== 'play') break;
      }
    }
    if (state.phase.id === 'done') break;
    const deadline = state.phase.deadline;
    if (deadline === null) throw new Error('Missing deadline');
    now = Math.max(now, deadline);
    reduce({ type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt });
  }
  if (now - T0 > BUDGET_MS)
    throw new Error(`Terminal budget exceeded: ${count}/${seed}/${skill}: ${now - T0}ms`);
  const results = game.results(state);
  if (
    !results ||
    results.ranking.length !== count ||
    roundLengths.length !== 3 ||
    Object.values(results.scores).some((score) => !Number.isFinite(score))
  )
    throw new Error(`Incomplete results: ${count}/${seed}/${skill}`);
  return { final: state, elapsed: now - T0, roundLengths, events };
}
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
