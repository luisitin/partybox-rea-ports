import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { readyDuration } from '../pacing';
import type { State, Transition } from '../types';
import { makeWorld } from '../world';
import type { Input } from '../world';

export function freshRound(state: State, now: number, round: number): State {
  const ids = Object.keys(state.players).filter((id) => !state.left.includes(id));
  const [world, rng] = makeWorld(state.rng, ids, state.settings.powerups);
  const slots = Object.keys(state.players);
  const stable = {
    ...world,
    tanks: world.tanks.map((tank) => ({ ...tank, slot: slots.indexOf(tank.id) })),
  };
  return {
    ...state,
    world: stable,
    rng,
    round,
    checked: 0,
    began: now,
    endsAt: now,
    reason: null,
    winnerIds: [],
    lastPoints: {},
  };
}
export function enterReady(state: State, now: number, round: number): State {
  const fresh = freshRound(state, now, round);
  return enterPhase(fresh, 'ready', now, readyDuration(fresh));
}
export function reduceReady(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
