// Completed floors only: attempts keep their best depth, and equal depths share a rank.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';

export function scoresOf(state: State): Record<string, number> {
  return Object.fromEntries(state.runners.map((r) => [r.id, r.best]));
}

export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  return {
    ...buildResults(state, scoresOf(state)),
    headlineNote: 'Deepest completed floor wins. Equal depths share a place.',
  };
}
