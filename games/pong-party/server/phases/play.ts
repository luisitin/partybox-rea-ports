// The engine re-arms a short beat; players see the full match clock instead.
import { hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import type { State, Transition } from '../types';
import { apply, finished, STEP_MS, TICK_MS, tick } from '../world';
import type { Input } from '../world';

export function settle(state: State, now: number): State {
  if (!Number.isFinite(now) || now < state.began + state.checked) return state;
  const world = tick(state.world, Math.min(now, state.endsAt) - state.began);
  return world === state.world ? state : { ...state, world, checked: world.stepped * STEP_MS };
}

export const over = (state: State): boolean =>
  state.checked >= state.endsAt - state.began || finished(state.world);

export function wake(state: State): number {
  return Math.min(state.endsAt, state.began + (Math.floor(state.checked / TICK_MS) + 1) * TICK_MS);
}

export function advancePlay(state: State, now: number, next: Transition): State {
  const judged = settle(state, now);
  return over(judged) ? next(judged, now) : nextStep(judged, wake(judged));
}

export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) &&
      state.phase.deadline !== null &&
      event.now >= state.phase.deadline
      ? advancePlay(state, event.now, next)
      : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !Number.isFinite(event.now) ||
    event.now < state.began + state.checked
  )
    return state;
  const seat = state.world.paddles.find((p) => p.id === event.playerId);
  if (
    !seat ||
    seat.lives <= 0 ||
    event.input?.type !== 'move' ||
    !Number.isFinite(event.input.position) ||
    event.input.position < 0 ||
    event.input.position > 1
  )
    return state;
  const judged = settle(state, event.now);
  if (over(judged)) return next(judged, event.now);
  const world = apply(judged.world, event.playerId, event.input);
  return world === judged.world ? judged : { ...judged, world };
}
