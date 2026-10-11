// Phase "answer": everyone types one word. Exits when every connected player has answered or
// the deadline fires. Phase files never import each other: `next` (the phase order) is injected
// by server/index.ts, so games whose phases loop stay free of circular imports.
import { allConnectedDone, enterPhase, hasPlayer, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import type { Input, State, Transition } from '../types';

export function enterAnswer(state: State, now: number): State {
  return enterPhase(state, 'answer', now, state.settings.answerSeconds * 1000);
}

export function reduceAnswer(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'input') {
    // Only playing players, only once each. Later inputs from the same player are ignored, which
    // keeps "submitted" honest on the TV and makes replays trivially deterministic.
    if (!hasPlayer(state, event.playerId) || Object.hasOwn(state.answers, event.playerId))
      return state;
    const after: State = {
      ...state,
      answers: { ...state.answers, [event.playerId]: event.input.text.trim() },
    };
    return allConnectedDone(after, Object.keys(after.answers)) ? next(after, event.now) : after;
  }
  if (isTimerFor(state, event)) return next(state, event.now);
  return state;
}
