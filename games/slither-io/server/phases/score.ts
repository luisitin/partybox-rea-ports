// A clear seven-second round result, then immediately the next arena.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { roundPoints } from '../scoring';
import { SCORE_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterScore(state: State, now: number): State {
  const lastPoints = roundPoints(state.world);
  const scores = Object.fromEntries(
    Object.keys(state.players).map((id) => [id, (state.scores[id] ?? 0) + (lastPoints[id] ?? 0)]),
  );
  return enterPhase({ ...state, lastPoints, scores }, 'score', now, SCORE_MS);
}

export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
