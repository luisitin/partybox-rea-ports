// Knowledge wins: speed only lets a player reach more questions before the shared cap.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';

export function answerPoints(correct: boolean, streak: number, double: boolean): number {
  return correct ? (100 + Math.min(60, Math.max(0, streak - 1) * 20)) * (double ? 2 : 1) : 0;
}
export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  return buildResults(
    state,
    Object.fromEntries(Object.entries(state.runners).map(([id, r]) => [id, r.score])),
  );
}
