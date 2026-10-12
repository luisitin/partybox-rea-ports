// The arena freezes at the horn while the room sees round mass and banked totals.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { roundPoints } from '../scoring';
import { SCORE_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { release } from '../world';

export function enterScore(state: State, now: number): State {
  if (state.phase.id === 'score' || state.phase.id === 'done') return state;
  const lastPoints = roundPoints(state.world, Object.keys(state.players));
  const scores = Object.fromEntries(
    Object.entries(state.scores).map(([id, n]) => [id, n + (lastPoints[id] ?? 0)]),
  );
  return enterPhase(
    { ...state, world: release(state.world), scores, lastPoints },
    'score',
    now,
    SCORE_MS,
  );
}
export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
