// The TV timer counts the round; small server deadlines keep idle boards falling too.
import { hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { applyInput, finished, inputSchema, settle } from '../engine';
import { TICK_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function wake(state: State): number {
  return Math.min(
    state.endsAt,
    state.began + (Math.floor((state.checked - state.began) / TICK_MS) + 1) * TICK_MS,
  );
}
export function advancePlay(state: State, now: number, next: Transition): State {
  const settled = settle(state, now);
  return finished(settled)
    ? next(settled, Math.min(now, settled.checked))
    : nextStep(settled, wake(settled));
}
export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) &&
      state.phase.deadline !== null &&
      event.now >= state.phase.deadline
      ? advancePlay(state, event.now, next)
      : state;
  if (event.type !== 'input' || !hasPlayer(state, event.playerId)) return state;
  const parsed = inputSchema.safeParse(event.input);
  if (!parsed.success) return state;
  // An old input must not act on a newer piece; it is ignored before any clock moves.
  if (event.now < state.checked) return state;
  const settled = settle(state, event.now);
  if (finished(settled)) return next(settled, settled.checked);
  const applied = applyInput(settled, event.playerId, parsed.data, event.now);
  return finished(applied) ? next(applied, applied.checked) : applied;
}
