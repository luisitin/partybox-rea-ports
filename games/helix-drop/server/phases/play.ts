// Rearmed beats judge physics even in an idle room; inputs change direction after settling old motion.
import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { HOLD_MS, ROUND_MS, TICK_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { allFinished, settle } from '../world';

export function enterPlay(state: State, now: number): State {
  return enterPhase(
    { ...state, began: now, endsAt: now + ROUND_MS, checked: 0 },
    'play',
    now,
    TICK_MS,
  );
}

export function advancePlay(state: State, now: number, next: Transition): State {
  const s = settle(state, now);
  if (now >= s.endsAt || allFinished(s)) return next(s, now);
  return nextStep(s, s.began + Math.min(ROUND_MS, (Math.floor(s.checked / TICK_MS) + 1) * TICK_MS));
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
    event.now < state.began + state.checked ||
    !state.players[event.playerId]?.connected
  )
    return state;
  const s = settle(state, event.now);
  if (event.now >= s.endsAt || allFinished(s)) return next(s, event.now);
  const runner = s.runners.find((r) => r.id === event.playerId);
  if (!runner || runner.lives <= 0 || runner.cleared || runner.respawnAt !== null) return s;
  return {
    ...s,
    runners: s.runners.map((r) =>
      r.id === event.playerId
        ? { ...r, dir: event.input.dir, heldUntil: event.now - s.began + HOLD_MS }
        : r,
    ),
  };
}
