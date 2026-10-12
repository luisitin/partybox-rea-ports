// Streaming strokes and private guesses. A two-second heartbeat reveals two letter hints.
import { enterPhase, hasPlayer, isTimerFor, shuffle } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { normalize as normalizeAnswer } from '@partybox/game-sdk/match';
import { guessPoints } from '../scoring';
import { answerCompact, answerSpellings } from '../answerMatch';
import { appendInk, continuesInk, undoInk } from '../ink';
import { BEAT_MS, MAX_STROKES } from '../types';
import type { State, Input, Transition } from '../types';
export function normalize(text: string): string {
  return normalizeAnswer(text, 'en').norm;
}
function oneEditApart(guess: string, answer: string): boolean {
  const a = [...guess];
  const b = [...answer];
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      if (++edits > 1) return false;
      if (a.length >= b.length) i++;
      if (b.length >= a.length) j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) === 1;
}
export function maskedWord(state: State): string {
  const revealed = new Set(state.hintOrder.slice(0, state.hintCount));
  return [...state.word]
    .map((letter, i) => (letter === ' ' ? ' / ' : revealed.has(i) ? letter : '_'))
    .join(' ');
}
export function guessers(state: State): string[] {
  return Object.keys(state.players).filter(
    (id) => id !== state.drawer && state.players[id]?.connected && !state.left.includes(id),
  );
}
export function allSolved(state: State): boolean {
  return guessers(state).every((id) => Object.hasOwn(state.solved, id));
}
export function enterDraw(state: State, now: number): State {
  const word = state.word || state.choices[0] || 'cat';
  const positions = [...word].flatMap((c, i) => (c === ' ' ? [] : [i]));
  const [hintOrder, rng] = shuffle(state.rng, positions);
  const endsAt = now + state.settings.drawSeconds * 1000;
  return enterPhase(
    {
      ...state,
      word,
      choices: [],
      used: [...state.used, word],
      hintOrder,
      rng,
      began: now,
      endsAt,
      clock: now,
    },
    'draw',
    now,
    BEAT_MS,
  );
}
export function reduceDraw(state: State, event: GameEvent<Input>, next: Transition): State {
  if (isTimerFor(state, event)) {
    if (event.now < (state.phase.deadline ?? Infinity)) return state;
    if (event.now >= state.endsAt || allSolved(state)) return next(state, event.now);
    const elapsed = event.now - state.began;
    const hintCount = Math.min(
      2,
      state.hintOrder.length - 1,
      Math.max(0, Math.floor((3 * elapsed) / (state.endsAt - state.began))),
    );
    return {
      ...state,
      clock: event.now,
      hintCount,
      phase: { ...state.phase, deadline: Math.min(state.endsAt, event.now + BEAT_MS) },
    };
  }
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected ||
    state.left.includes(event.playerId) ||
    event.now < state.clock ||
    event.now >= state.endsAt
  )
    return state;
  const { playerId, input, now } = event;
  if (playerId === state.drawer) {
    if (input.type === 'clear')
      return { ...state, clock: now, inkRevision: state.inkRevision + 1, strokes: [] };
    if (input.type === 'undo')
      return {
        ...state,
        clock: now,
        inkRevision: state.inkRevision + 1,
        strokes: undoInk(state.strokes),
      };
    if (
      input.type === 'stroke' &&
      (state.strokes.length < MAX_STROKES || continuesInk(state.strokes, input.stroke))
    )
      return {
        ...state,
        clock: now,
        inkRevision: state.inkRevision + 1,
        strokes: appendInk(state.strokes, input.stroke),
      };
    return state;
  }
  if (input.type !== 'guess' || Object.hasOwn(state.solved, playerId)) return state;
  const text = normalize(input.text);
  if (now - (state.lastGuessAt[playerId] ?? -Infinity) < 750)
    return { ...state, feedback: { ...state.feedback, [playerId]: 'Wait a moment' } };
  const guesses = {
    ...state.guesses,
    [playerId]: [...(state.guesses[playerId] ?? []).slice(-23), input.text.trim()],
  };
  const fresh: State = {
    ...state,
    clock: now,
    guesses,
    lastGuessAt: { ...state.lastGuessAt, [playerId]: now },
  };
  const compact = answerCompact(text);
  const answer = answerCompact(state.word);
  if (compact !== answer) {
    const close = answerSpellings(state.word).some((spelling) => oneEditApart(compact, spelling));
    return {
      ...fresh,
      feedback: { ...state.feedback, [playerId]: close ? 'Close!' : 'Try another word' },
    };
  }
  const points = guessPoints(state, now);
  const solved = { ...state.solved, [playerId]: points };
  const scores = {
    ...state.scores,
    [playerId]: (state.scores[playerId] ?? 0) + points,
    [state.drawer]: (state.scores[state.drawer] ?? 0) + 250,
  };
  const gains = {
    ...state.gains,
    [playerId]: points,
    [state.drawer]: (state.gains[state.drawer] ?? 0) + 250,
  };
  const after: State = {
    ...fresh,
    solved,
    scores,
    gains,
    feedback: { ...state.feedback, [playerId]: 'Correct!' },
  };
  return allSolved(after) ? next(after, now) : after;
}
