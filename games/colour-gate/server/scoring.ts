// Gate count dominates partial height; scores add once on entry to score.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import { GAP } from './types';
import type { Runner, State, World } from './types';

export function runnerPoints(runner: Runner): number {
  return (
    runner.gates * 100 +
    Math.max(0, Math.min(99, Math.floor(((runner.bestHeight - runner.gates * GAP) * 100) / GAP)))
  );
}
export function roundPoints(world: World): Record<string, number> {
  return Object.fromEntries(world.runners.map((runner) => [runner.id, runnerPoints(runner)]));
}
export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
