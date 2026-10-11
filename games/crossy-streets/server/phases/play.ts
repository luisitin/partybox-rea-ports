import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { distanceScores } from '../scoring';
import type { State, Transition } from '../types';
import { apply, STEP_MS, TICK_MS, tick } from '../world';
import type { Input } from '../world';

const duration = (state: State): number => state.endsAt - state.began;

function wake(state: State): number {
  const nextBeat = (Math.floor(state.checked / TICK_MS) + 1) * TICK_MS;
  return state.began + Math.min(duration(state), nextBeat);
}

export function enterPlay(state: State, now: number): State {
  const open = enterPhase(
    { ...state, began: now, endsAt: now + state.seconds * 1000, checked: 0 },
    'play',
    now,
    null,
  );
  return nextStep(open, wake(open));
}

export function settle(state: State, now: number): State {
  const to = Math.min(duration(state), Math.max(0, now - state.began));
  const checked = Math.max(state.checked, Math.floor(to / STEP_MS) * STEP_MS);
  if (checked <= state.checked) return state;
  const world = tick(state.world, checked);
  return { ...state, checked, world, scores: distanceScores(world) };
}

export function advancePlay(state: State, now: number, done: Transition): State {
  const judged = settle(state, now);
  return judged.checked >= duration(judged) ? done(judged, now) : nextStep(judged, wake(judged));
}

export function skipPlay(state: State, now: number, done: Transition): State {
  return done(settle(state, now), now);
}

export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) &&
      state.phase.deadline !== null &&
      event.now >= state.phase.deadline
      ? next(state, event.now)
      : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected
  )
    return state;
  // Old packets never apply at a new position. Unknown seats cannot move the shared clock.
  if (event.now < state.began + state.checked) return state;
  const judged = settle(state, event.now);
  if (judged.checked >= duration(judged)) return next(judged, event.now);
  const world = apply(judged.world, event.playerId, event.input, judged.checked);
  return world === judged.world ? judged : { ...judged, world, scores: distanceScores(world) };
}
