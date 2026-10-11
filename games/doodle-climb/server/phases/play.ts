// Climbing has a bounded clock and never waits for a player's phone.
import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { STEP_MS, TICK_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { apply, tick } from '../world';

export function enterPlay(state: State, now: number): State {
  return enterPhase(
    { ...state, began: now, endsAt: now + state.settings.seconds * 1000, elapsed: 0 },
    'play',
    now,
    TICK_MS,
  );
}
export function settle(state: State, now: number): State {
  const to = Math.max(0, Math.min(now - state.began, state.endsAt - state.began));
  const world = tick(state.world, to);
  return world === state.world ? state : { ...state, world, elapsed: world.stepped * STEP_MS };
}
export function over(state: State): boolean {
  return (
    state.elapsed >= state.endsAt - state.began ||
    state.world.climbers.every((c) => c.died !== null)
  );
}
export function advancePlay(state: State, now: number, next: Transition): State {
  const s = settle(state, now);
  return over(s)
    ? next(s, now)
    : nextStep(
        s,
        s.began + Math.min(s.endsAt - s.began, (Math.floor(s.elapsed / TICK_MS) + 1) * TICK_MS),
      );
}
export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) ? advancePlay(state, event.now, next) : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected ||
    event.now < state.began + state.elapsed
  )
    return state;
  const s = settle(state, event.now);
  if (over(s)) return next(s, event.now);
  const world = apply(s.world, event.playerId, event.input);
  return world === s.world ? s : { ...s, world };
}
