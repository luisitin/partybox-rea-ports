// The answer and points land together, with time to read before the next artist.
import { enterPhase, isTimerFor, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import type { State, Input, Transition } from '../types';
export function enterReveal(state: State, now: number): State {
  const duration = Math.max(
    8000,
    readingMs(wordCount(`The word was ${state.word}. Next artist gets ready.`), { ui: true }),
  );
  return enterPhase({ ...state, clock: now }, 'reveal', now, duration);
}
export function reduceReveal(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
