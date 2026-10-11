// Timer beats advance every lane, including disconnected players. Inputs cannot revive a crash.
import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import type { State, Transition } from '../types';
import { ROUND_MS, TICK_MS, applyFlap, finished, makeWorld, tick } from '../world';
import type { Input } from '../world';

export function enterPlay(state: State, now: number, round: number): State {
  const [world, rng] = makeWorld(state.rng, Object.keys(state.players));
  return enterPhase(
    { ...state, world, rng, began: now, endsAt: now + ROUND_MS, round, lastPoints: {} },
    'play',
    now,
    TICK_MS,
  );
}
export function settle(state: State, now: number): State {
  const world = tick(state.world, Math.min(now - state.began, state.endsAt - state.began));
  return world === state.world ? state : { ...state, world };
}
export function over(state: State): boolean {
  return finished(state.world) || state.world.checked >= state.endsAt - state.began;
}
export function advancePlay(state: State, now: number, next: Transition): State {
  const judged = settle(state, now);
  return over(judged)
    ? next(judged, now)
    : nextStep(
        judged,
        state.began +
          Math.min(
            state.endsAt - state.began,
            (Math.floor(judged.world.checked / TICK_MS) + 1) * TICK_MS,
          ),
      );
}
export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) ? advancePlay(state, event.now, next) : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected ||
    event.now < state.began + state.world.checked
  )
    return state;
  const judged = settle(state, event.now);
  if (over(judged)) return next(judged, event.now);
  const world = applyFlap(judged.world, event.playerId, event.now - judged.began);
  const flapped = world === judged.world ? judged : { ...judged, world };
  return over(flapped) ? next(flapped, event.now) : flapped;
}
