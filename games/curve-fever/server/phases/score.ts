// Phase "score": the round is over; the standings stay up a few seconds. The deadline (or a VIP skip) starts the next round, or
// ends the match after the last one. Points are locked in on entry.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { roundPoints } from '../scoring';
import { SCORE_MS } from '../types';
import type { State, Transition } from '../types';
import type { Input } from '../world';

export function enterScore(state: State, now: number): State {
  const lastPoints = roundPoints(state.world);
  const scores = { ...state.scores };
  for (const [id, n] of Object.entries(lastPoints)) scores[id] = (scores[id] ?? 0) + n;
  return enterPhase({ ...state, scores, lastPoints }, 'score', now, SCORE_MS);
}

export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) ? next(state, event.now) : state;
}
