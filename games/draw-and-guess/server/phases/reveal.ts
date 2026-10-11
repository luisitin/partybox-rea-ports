// The stage reveals the answer and credits each solver exactly once, then rotates artists.
import { enterPhase, isTimerFor, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { drawerPoints, guessPoints } from '../scoring';
import { REVEAL_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterReveal(state: State, now: number): State {
  const lastPoints: Record<string, number> = Object.fromEntries(
    Object.keys(state.players).map((id) => [id, 0]),
  );
  if (state.phase.id === 'draw') {
    for (const [id, at] of Object.entries(state.solved))
      lastPoints[id] = guessPoints(at - state.began, state.endsAt - state.began);
    lastPoints[state.drawerId] = drawerPoints(
      Object.keys(state.solved).length,
      state.eligibleAtStart,
    );
  }
  const scores = Object.fromEntries(
    Object.entries(state.scores).map(([id, total]) => [id, total + (lastPoints[id] ?? 0)]),
  );
  const duration = Math.max(
    REVEAL_MS,
    readingMs(
      wordCount(`The word was ${state.word?.text ?? 'not chosen'}. Points earned. Next artist.`),
      { ui: true },
    ),
  );
  return enterPhase({ ...state, scores, lastPoints }, 'reveal', now, duration);
}
export function reduceReveal(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && state.phase.deadline !== null && event.now >= state.phase.deadline ? next(state, event.now) : state;
}
