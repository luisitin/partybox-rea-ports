// Scores reward quick recognition and understandable pictures; ties share a rank.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';
export function guessPoints(state: State, now: number): number {
  const fraction = Math.max(0, Math.min(1, (state.endsAt - now) / (state.endsAt - state.began)));
  return 300 + Math.floor(700 * fraction);
}
export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
