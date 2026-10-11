// Phase "ready": a new round's worms sit at their start spots, facing in, for a few seconds so everyone can find theirs.
// The deadline (or a VIP skip) lets them go.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { READY_MS } from '../types';
import type { Transition, State } from '../types';
import { makeWorld } from '../world';
import type { Input } from '../world';

/** A fresh board for round `round`; `rng` moves on. */
export function enterReady(state: State, now: number, round: number): State {
  const [world, rng] = makeWorld(state.rng, Object.keys(state.players));
  const fresh: State = { ...state, world, rng, round, checked: 0, began: now, endsAt: now };
  return enterPhase(fresh, 'ready', now, READY_MS);
}

export function reduceReady(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) ? next(state, event.now) : state;
}
