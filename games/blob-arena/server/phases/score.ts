// The arena freezes at the horn while the room sees round mass and banked totals.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { roundPoints } from '../scoring';
import { SCORE_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterScore(state: State, now: number): State {
  const lastPoints = roundPoints(state.world, Object.keys(state.players));
  const scores = Object.fromEntries(
    Object.entries(state.scores).map(([id, n]) => [id, n + (lastPoints[id] ?? 0)]),
  );
  return enterPhase({ ...state, scores, lastPoints }, 'score', now, SCORE_MS);
}
export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) ? next(state, event.now) : state;
}
