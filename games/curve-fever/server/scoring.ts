// Scoring for Curve Fever: each round, a player scores one point for every opponent who died before them (living to the end beats
// everyone who died; worms that die on the same sample tie). The match goes to the most points; equal scores share the rank.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';
import type { World } from './world';

/** What a finished round gives each player. */
export function roundPoints(world: World): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of world.worms) {
    const at = a.died ?? Infinity;
    out[a.id] = world.worms.filter((b) => (b.died ?? Infinity) < at).length;
  }
  return out;
}

export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  return buildResults(state, state.scores);
}
