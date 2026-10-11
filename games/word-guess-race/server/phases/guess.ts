// An acknowledged guess changes only its owner's history; unfinished disconnected seats never delay the room.
import { allConnectedDone, enterPhase, hasPlayer, isTimerFor, z } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { ACCEPTED } from '../content';
import { canonicalWord, feedback } from '../letters';
import { emptyEntry, finished } from '../types';
import type { Entry, Input, State, Transition } from '../types';

export const inputSchema = z.object({
  type: z.literal('guess'),
  word: z.string().max(64),
  round: z.number().int().min(1).max(3),
});

export function enterGuess(state: State, now: number, round: number): State {
  return enterPhase(
    {
      ...state,
      round,
      began: now,
      entries: Object.fromEntries(Object.keys(state.players).map((id) => [id, emptyEntry()])),
      lastPoints: Object.fromEntries(Object.keys(state.players).map((id) => [id, 0])),
      roundScored: false,
    },
    'guess',
    now,
    state.settings.roundSeconds * 1000,
  );
}

export function closeIfDone(state: State, now: number, next: Transition): State {
  if (state.phase.id !== 'guess' || state.phase.paused) return state;
  const done = Object.keys(state.entries).filter((id) => finished(state.entries[id]!));
  return allConnectedDone(state, done) ? next(state, now) : state;
}

function acknowledged(state: State, id: string, entry: Entry, error: string | null): State {
  return {
    ...state,
    entries: {
      ...state.entries,
      [id]: { ...entry, error, submissionVersion: entry.submissionVersion + 1 },
    },
  };
}

export function reduceGuess(state: State, event: GameEvent<Input>, next: Transition): State {
  if (isTimerFor(state, event))
    return event.now >= (state.phase.deadline ?? Infinity) ? next(state, event.now) : state;
  if (event.type !== 'input' || !hasPlayer(state, event.playerId)) return state;
  const entry = state.entries[event.playerId];
  if (!entry || finished(entry) || state.players[event.playerId]?.connected !== true) return state;
  if (
    !event.input ||
    event.input.type !== 'guess' ||
    typeof event.input.word !== 'string' ||
    event.input.round !== state.round
  )
    return state;
  if (event.now < state.began) return state;
  if (state.phase.deadline !== null && event.now >= state.phase.deadline)
    return next(state, event.now);
  const word = canonicalWord(event.input.word);
  if (word === null) return acknowledged(state, event.playerId, entry, 'Use exactly five letters.');
  if (!ACCEPTED.includes(word))
    return acknowledged(state, event.playerId, entry, 'Word not in our dictionary.');
  if (entry.guesses.some((guess) => guess.word === word))
    return acknowledged(state, event.playerId, entry, 'You already tried that word.');
  const marks = feedback(word, state.answers[state.round - 1]!);
  const solved = marks.every((mark) => mark === 'correct');
  const after = acknowledged(
    state,
    event.playerId,
    {
      ...entry,
      guesses: [...entry.guesses, { word, marks }],
      solvedElapsedMs: solved ? Math.max(0, event.now - state.began) : null,
    },
    null,
  );
  return closeIfDone(after, event.now, next);
}
