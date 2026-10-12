import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { READY_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { makeWorld } from '../world';

export function enterReady(state: State, now: number, round: number): State {
  const world = makeWorld(Object.keys(state.players), state.left, round, state.spawnOffset);
  return enterPhase(
    {
      ...state,
      world,
      round,
      began: now,
      endsAt: now,
      checked: 0,
      lastPoints: {},
      lastWinners: [],
      roundOutcome: null,
    },
    'ready',
    now,
    READY_MS,
  );
}

export function reduceReady(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
