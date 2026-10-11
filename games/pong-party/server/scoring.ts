// A life always beats every possible save bonus; equal life/save totals share their rank.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';

export function scoresOf(state: State): Record<string, number> {
  const scores = Object.fromEntries(Object.keys(state.players).map((id) => [id, 0]));
  for (const paddle of state.world.paddles) scores[paddle.id] = paddle.lives * 1000 + paddle.saves;
  return scores;
}

export function results(state: State): GameResults | null {
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
