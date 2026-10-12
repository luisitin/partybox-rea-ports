import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { roundPoints } from '../scoring';
import { scoreDuration } from '../pacing';
import type { State, Transition } from '../types';
import { aliveCount } from '../world';
import type { Input } from '../world';

export function enterScore(state: State, now: number): State {
  const lastPoints = roundPoints(state.world);
  const scores = { ...state.scores };
  for (const [id, points] of Object.entries(lastPoints)) scores[id] = (scores[id] ?? 0) + points;
  const winnerIds = Object.keys(lastPoints).filter((id) => lastPoints[id] === 1);
  const count = aliveCount(state.world);
  const reason = state.reason ?? (count === 1 ? 'last-standing' : count === 0 ? 'draw' : 'time');
  const scored = { ...state, scores, lastPoints, winnerIds, reason };
  return enterPhase(scored, 'score', now, scoreDuration(scored));
}
export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
