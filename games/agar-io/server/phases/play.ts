// Play re-arms the engine deadline while views show the full 90-second clock.
import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { makeWorld } from '../spawn';
import { apply, tick } from '../world';
import { ROUND_MS, WAKE_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterPlay(state: State, now: number, round = state.round): State {
  const [world, rng] = makeWorld(
    state.rng,
    Object.keys(state.players).filter((id) => !state.left.includes(id)),
  );
  return enterPhase(
    { ...state, world, rng, began: now, endsAt: now + ROUND_MS, round },
    'play',
    now,
    WAKE_MS,
  );
}
export function settle(state: State, now: number): State {
  if (state.phase.id !== 'play' || state.phase.paused) return state;
  const to = Math.min(ROUND_MS, Math.max(0, now - state.began));
  const [world, rng] = tick(state.world, state.rng, to, state.left);
  return world === state.world ? state : { ...state, world, rng };
}
export function advancePlay(state: State, now: number, score: Transition): State {
  const s = settle(state, now);
  return now >= s.endsAt
    ? score(s, now)
    : nextStep(s, s.began + Math.min(ROUND_MS, s.world.time + WAKE_MS));
}
export function reducePlay(state: State, event: GameEvent<Input>, score: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) &&
      state.phase.deadline !== null &&
      event.now >= state.phase.deadline
      ? advancePlay(state, event.now, score)
      : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected ||
    state.left.includes(event.playerId)
  )
    return state;
  const control = Object.hasOwn(state.world.controls, event.playerId)
    ? state.world.controls[event.playerId]
    : undefined;
  if (
    !control ||
    !state.world.cells.some((cell) => cell.owner === event.playerId) ||
    event.now < state.began + Math.max(state.world.time, control.at)
  )
    return state;
  const parsed =
    event.input?.type === 'steer' || event.input?.type === 'split' ? event.input : null;
  if (!parsed) return state;
  if (
    parsed.type === 'steer' &&
    (!Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y) ||
      Math.abs(parsed.x) > 1 ||
      Math.abs(parsed.y) > 1)
  )
    return state;
  const s = settle(state, event.now);
  if (event.now >= s.endsAt) return score(s, event.now);
  const world = apply(s.world, event.playerId, parsed, event.now - s.began);
  return world === s.world ? s : { ...s, world };
}
