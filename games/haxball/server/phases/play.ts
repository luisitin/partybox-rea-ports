import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { BEAT_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { advanceWorld, applyControl } from '../world';
import type { Goal } from '../types';

export function enterPlay(state: State, now: number): State {
  return enterPhase(
    { ...state, clock: now, simAt: now },
    'play',
    now,
    Math.min(BEAT_MS, Math.max(0, state.halfEndsAt - now)),
  );
}
export function settlePlay(
  state: State,
  now: number,
  endHalf: Transition,
  goal: (s: State, g: Goal, at: number) => State,
): State {
  // Judge old motion through the horn, including its last fixed step; never apply a late control.
  const settled = advanceWorld(state, now);
  if (settled.goal) return goal(settled.state, settled.goal, settled.state.simAt);
  if (now >= state.halfEndsAt) return endHalf(settled.state, state.halfEndsAt);
  const beat =
    state.phase.startedAt + (Math.floor((now - state.phase.startedAt) / BEAT_MS) + 1) * BEAT_MS;
  return nextStep({ ...settled.state, clock: now }, Math.min(state.halfEndsAt, beat));
}
export function reducePlay(state: State, event: GameEvent<Input>, settle: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
      ? settle(state, event.now)
      : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected ||
    state.left.includes(event.playerId) ||
    event.input.phaseAt !== state.phase.startedAt ||
    event.input.seq <= (state.intents[event.playerId]?.seq ?? -1)
  )
    return state;
  const settled = settle(state, event.now);
  return settled.phase.id === 'play' && settled.phase.startedAt === state.phase.startedAt
    ? applyControl(settled, event.playerId, event.input, event.now)
    : settled;
}
