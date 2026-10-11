// A short rematch beat only between climbs; the shell owns the initial start.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { makeWorld } from '../content';
import { READY_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function freshRound(state: State, round: number): State {
  const [world, rng] = makeWorld(state.rng, Object.keys(state.players));
  const seats = {
    ...world,
    climbers: world.climbers.map((c) => (state.left.includes(c.id) ? { ...c, died: 0 } : c)),
  };
  return { ...state, world: seats, rng, round, elapsed: 0, lastPoints: {} };
}
export function enterReady(state: State, now: number): State {
  return enterPhase(freshRound(state, state.round + 1), 'ready', now, READY_MS);
}
export function reduceReady(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) ? next(state, event.now) : state;
}
