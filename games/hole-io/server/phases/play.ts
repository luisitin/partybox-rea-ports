// Engine deadlines re-arm every 200 ms; the public clock is the full 90-second round.
import { hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { scoresOf } from '../scoring';
import { TICK_MS } from '../types';
import type { Input, State } from '../types';
import { applyMove, tick } from '../world';

export function settle(state: State, now: number): State {
  if (state.phase.id !== 'play' || state.phase.paused) return state;
  const world = tick(state.world, Math.min(state.endsAt, now) - state.began);
  return world === state.world ? state : { ...state, world, scores: scoresOf(world) };
}
export function advancePlay(
  state: State,
  now: number,
  next: (s: State, n: number) => State,
): State {
  const s = settle(state, now);
  return now >= s.endsAt ? next(s, now) : nextStep(s, Math.min(s.endsAt, now + TICK_MS));
}
export function reducePlay(
  state: State,
  event: GameEvent<Input>,
  next: (s: State, n: number) => State,
): State {
  if (event.type === 'timer') {
    if (!isTimerFor(state, event) || event.now < (state.phase.deadline ?? Infinity)) return state;
    return advancePlay(state, event.now, next);
  }
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected ||
    event.now < state.began + state.world.elapsed
  )
    return state;
  const s = settle(state, event.now);
  if (event.now >= s.endsAt) return next(s, event.now);
  const world = applyMove(s.world, event.playerId, event.input);
  return world === s.world ? s : { ...s, world };
}
