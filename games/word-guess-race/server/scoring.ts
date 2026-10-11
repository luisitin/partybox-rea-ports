// Pairwise points: a solve outranks a miss, then fewer guesses, then less active time.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { Entry, State } from './types';

export function beats(a: Entry, b: Entry): boolean {
  if (a.solvedElapsedMs === null) return false;
  if (b.solvedElapsedMs === null) return true;
  if (a.guesses.length !== b.guesses.length) return a.guesses.length < b.guesses.length;
  return a.solvedElapsedMs < b.solvedElapsedMs;
}

export function roundPoints(state: State): Record<string, number> {
  const ids = Object.keys(state.players);
  return Object.fromEntries(
    ids.map((id) => [
      id,
      ids.filter((other) => other !== id && beats(state.entries[id]!, state.entries[other]!))
        .length,
    ]),
  );
}

export function settleRound(state: State): State {
  if (state.roundScored) return state;
  const lastPoints = roundPoints(state);
  const scores = Object.fromEntries(
    Object.keys(state.players).map((id) => [id, state.scores[id]! + lastPoints[id]!]),
  );
  return { ...state, scores, lastPoints, roundScored: true };
}

export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
