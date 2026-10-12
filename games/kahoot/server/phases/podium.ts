// One occupied tied-rank tier at a time, third → second → first. Scores were locked by reveal.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { occupiedPodiumRanks } from '../standings';
import { podiumMs } from '../pacing';
import type { Input, State } from '../types';
import type { Advance } from './intro';

export function enterPodium(state: State, now: number, rank?: 1 | 2 | 3): State {
  const podiumRank = rank ?? occupiedPodiumRanks(state)[0] ?? 1;
  const stepped = { ...state, podiumRank };
  return enterPhase(stepped, 'podium', now, podiumMs(stepped));
}
export function reducePodium(state: State, event: GameEvent<Input>, next: Advance): State {
  if (
    isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
  )
    return next(state, event.now);
  return state;
}
