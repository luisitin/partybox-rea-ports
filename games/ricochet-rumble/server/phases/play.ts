import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import type { State, Transition } from '../types';
import { ROUND_MS, STEP_MS, TICK_MS, apply, finished, tick } from '../world';
import type { Input } from '../world';

export function enterPlay(state: State, now: number): State {
  const open = enterPhase(
    { ...state, began: now, endsAt: now + ROUND_MS, checked: 0 },
    'play',
    now,
    TICK_MS,
  );
  return open;
}
export function settle(state: State, now: number): State {
  const to = Math.max(0, Math.min(now - state.began, state.endsAt - state.began));
  const world = tick(state.world, to);
  return world === state.world ? state : { ...state, world, checked: world.stepped * STEP_MS };
}
export const isOver = (state: State): boolean =>
  finished(state.world) || state.checked >= state.endsAt - state.began;
function wake(state: State): number {
  return Math.min(state.endsAt, state.began + (Math.floor(state.checked / TICK_MS) + 1) * TICK_MS);
}
export function advancePlay(state: State, now: number, done: Transition): State {
  const settled = settle(state, now);
  if (isOver(settled)) return done(settled, now);
  return nextStep(settled, wake(settled));
}
export function skipPlay(state: State, now: number, done: Transition): State {
  return done({ ...settle(state, now), reason: 'skip' }, now);
}
export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
      ? advancePlay(state, event.now, next)
      : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    state.left.includes(event.playerId) ||
    !state.players[event.playerId]?.connected ||
    event.now < state.began + state.checked
  )
    return state;
  const settled = settle(state, event.now);
  if (isOver(settled)) return next(settled, event.now);
  const world = apply(settled.world, event.playerId, event.input, event.now - settled.began);
  return world === settled.world ? settled : { ...settled, world };
}
