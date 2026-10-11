import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import type { State, Transition } from '../types';
import { ROUND_MS, TICK_MS, allDead, apply, makeWorld, tick } from '../world';
import type { Input } from '../world';

export function enterPlay(state: State, now: number, round: number): State {
  const [world, rng] = makeWorld(state.rng, Object.keys(state.players).filter((id) => !state.left.includes(id)));
  return enterPhase({ ...state, world, rng, round, began: now, endsAt: now + ROUND_MS }, 'play', now, TICK_MS);
}
export function settle(state: State, now: number): State {
  const world = tick(state.world, Math.min(ROUND_MS, now - state.began));
  return world === state.world ? state : { ...state, world };
}
const over = (state: State): boolean => state.world.checked >= ROUND_MS || allDead(state.world);
export function advancePlay(state: State, now: number, done: Transition): State {
  const s = settle(state, now);
  return over(s) ? done(s, now) : nextStep(s, Math.min(s.endsAt, now + TICK_MS));
}
export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer') return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? advancePlay(state, event.now, next) : state;
  if (event.type !== 'input' || !hasPlayer(state, event.playerId) || !state.players[event.playerId]?.connected)
    return state;
  const runner = state.world.runners.find((r) => r.id === event.playerId);
  if (!runner || runner.died !== null || event.now < state.began + state.world.checked) return state;
  const s = settle(state, event.now);
  if (over(s)) return next(s, event.now);
  const world = apply(s.world, event.playerId, event.input, event.now - s.began);
  return world === s.world ? s : { ...s, world };
}
