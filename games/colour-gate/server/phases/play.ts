// The race re-arms one data deadline every 100ms; no input is needed to finish it.
import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { ROUND_MS, TICK_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { makeWorld, tap, tick } from '../world';

export function enterPlay(state: State, now: number, round = state.round): State {
  const [world, rng] = makeWorld(state.rng, Object.keys(state.players));
  return enterPhase(
    { ...state, world, rng, round, began: now, endsAt: now + ROUND_MS },
    'play',
    now,
    TICK_MS,
  );
}
export function settle(state: State, now: number): State {
  const world = tick(state.world, Math.min(ROUND_MS, Math.max(0, now - state.began)));
  return world === state.world ? state : { ...state, world };
}
export function advancePlay(state: State, now: number, next: Transition): State {
  const settled = settle(state, now);
  return now >= state.endsAt
    ? next(settled, now)
    : nextStep(
        settled,
        Math.min(
          state.endsAt,
          state.began + (Math.floor(settled.world.checked / TICK_MS) + 1) * TICK_MS,
        ),
      );
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
    event.now < state.began + state.world.checked
  )
    return state;
  const settled = settle(state, event.now);
  if (event.now >= state.endsAt) return next(settled, event.now);
  const world = tap(settled.world, event.playerId, event.now - settled.began);
  return world === settled.world ? settled : { ...settled, world };
}
