import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { roundPoints } from '../scoring';
import { SCORE_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { aliveCount, release } from '../world';

export function enterScore(state: State, now: number): State {
  if (state.phase.id === 'score' || state.phase.id === 'done') return state;
  const timeout = state.checked >= state.endsAt - state.began;
  const lastPoints = roundPoints(state.world, timeout);
  const scores = { ...state.scores };
  for (const [id, points] of Object.entries(lastPoints)) scores[id] = (scores[id] ?? 0) + points;
  const alive = aliveCount(state.world);
  const roundOutcome =
    alive === 0 ? 'draw' : alive === 1 ? 'last-standing' : timeout ? 'timeout' : 'draw';
  return enterPhase(
    {
      ...state,
      world: release(state.world),
      lastPoints,
      scores,
      roundOutcome,
      lastWinners: state.world.balls.filter((b) => lastPoints[b.id] === 1).map((b) => b.id),
    },
    'score',
    now,
    SCORE_MS,
  );
}

export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
