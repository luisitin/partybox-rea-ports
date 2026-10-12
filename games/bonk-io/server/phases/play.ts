import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import type { Input, State, Transition } from '../types';
import { ROUND_MS, STEP_MS, TICK_MS, apply, finished, tick } from '../world';

export const over = (state: State): boolean =>
  finished(state.world) || state.checked >= state.endsAt - state.began;
const wake = (state: State): number =>
  state.began +
  Math.min(state.endsAt - state.began, (Math.floor(state.checked / TICK_MS) + 1) * TICK_MS);

export function enterPlay(state: State, now: number): State {
  const started = enterPhase(
    { ...state, began: now, endsAt: now + ROUND_MS, checked: 0 },
    'play',
    now,
    null,
  );
  return nextStep(started, wake(started));
}

export function settle(state: State, now: number): State {
  if (state.phase.id !== 'play' || state.phase.paused) return state;
  const to = Math.min(now - state.began, state.endsAt - state.began);
  if (to < 0 || to <= state.checked) return state;
  const world = tick(state.world, to);
  const checked = world.stepped * STEP_MS;
  return world === state.world && checked === state.checked ? state : { ...state, world, checked };
}

export function advancePlay(state: State, now: number, next: Transition): State {
  const judged = settle(state, now);
  return over(judged) ? next(judged, now) : nextStep(judged, wake(judged));
}

export function skipPlay(state: State, now: number, next: Transition): State {
  return next(settle(state, now), now);
}

export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
      ? advancePlay(state, event.now, next)
      : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected ||
    state.left.includes(event.playerId)
  )
    return state;
  const ball = state.world.balls.find((b) => b.id === event.playerId);
  if (!ball?.alive || event.now < state.began + Math.max(state.checked, ball.controlAt))
    return state;
  const judged = settle(state, event.now);
  if (over(judged)) return next(judged, event.now);
  const world = apply(judged.world, event.playerId, event.input, event.now - judged.began);
  return world === judged.world ? judged : { ...judged, world };
}
