import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { ROUND_MS, TICK_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { applyDirection, tickWorld } from '../world';

function wake(state: State): number {
  return Math.min(state.endsAt, state.began + state.checked + TICK_MS);
}
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
  const toTick = Math.min(
    ROUND_MS / TICK_MS,
    Math.max(state.world.stepped, Math.floor((now - state.began) / TICK_MS)),
  );
  if (toTick <= state.world.stepped) return state;
  const activeIds = Object.values(state.players)
    .filter((p) => p.connected && !state.left.includes(p.id))
    .map((p) => p.id);
  return { ...state, world: tickWorld(state.world, toTick, activeIds), checked: toTick * TICK_MS };
}
export function advancePlay(state: State, now: number, next: Transition): State {
  const settled = settle(state, now);
  return settled.checked >= ROUND_MS ? next(settled, now) : nextStep(settled, wake(settled));
}
export function skipPlay(state: State, now: number, next: Transition): State {
  return next(settle(state, now), now);
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
    !state.players[event.playerId]?.connected ||
    state.left.includes(event.playerId)
  )
    return state;
  const settled = settle(state, event.now);
  if (settled.checked >= ROUND_MS) return next(settled, event.now);
  const world = applyDirection(settled.world, event.playerId, event.input);
  return world === settled.world ? settled : { ...settled, world };
}
