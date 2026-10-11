// Live bounded drawing, private guesses, and two deadline-driven letter hints.
import { enterPhase, hasPlayer, isTimerFor, nextStep, shuffle } from '@partybox/game-sdk';
import { matchAnswer } from '@partybox/game-sdk/match';
import type { GameEvent } from '@partybox/game-sdk';
import { MAX_GUESSES, MAX_POINTS, MAX_STROKES } from '../types';
import type { Input, State, Transition } from '../types';

export function eligibleIds(state: State): string[] {
  return Object.values(state.players)
    .filter((p) => p.id !== state.drawerId && p.connected && !state.left.includes(p.id))
    .map((p) => p.id);
}
export function allSolved(state: State): boolean {
  return eligibleIds(state).every((id) => Object.hasOwn(state.solved, id));
}
export function enterDraw(state: State, now: number): State {
  const word = state.word ?? state.choices[0] ?? null;
  const indices = [...(word?.text ?? '')].flatMap((letter, i) => (letter === ' ' ? [] : [i]));
  const [hintIndices, rng] = shuffle(state.rng, indices);
  const endsAt = now + state.settings.seconds * 1000;
  const opened = enterPhase(
    {
      ...state,
      word,
      rng,
      hintIndices,
      hintLevel: 0,
      used: word ? [...state.used, word.id] : state.used,
      began: now,
      endsAt,
      checkedAt: now,
      eligibleAtStart: eligibleIds(state).length,
    },
    'draw',
    now,
    null,
  );
  return nextStep(opened, now + (endsAt - now) / 3);
}
export function advanceDraw(state: State, now: number, next: Transition): State {
  if (now >= state.endsAt || allSolved(state)) return next(state, now);
  const hintLevel = Math.min(
    2,
    Math.floor((3 * (now - state.began)) / (state.endsAt - state.began)),
  );
  const deadline = state.began + ((hintLevel + 1) * (state.endsAt - state.began)) / 3;
  return nextStep({ ...state, hintLevel, checkedAt: Math.max(state.checkedAt, now) }, deadline);
}
export function reduceDraw(state: State, event: GameEvent<Input>, next: Transition): State {
  if (
    isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
  )
    return advanceDraw(state, event.now, next);
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected ||
    state.left.includes(event.playerId) ||
    event.now < state.checkedAt ||
    event.now < state.began
  )
    return state;
  if (event.now >= state.endsAt) return next(state, event.now);
  const { input, playerId } = event;
  if (playerId === state.drawerId) {
    if (input.type === 'stroke') {
      const points = state.strokes.reduce((n, stroke) => n + stroke.points.length, 0);
      if (
        input.stroke.seq <= state.lastSeq ||
        input.stroke.id < state.lastStroke ||
        state.strokes.length >= MAX_STROKES ||
        points + input.stroke.points.length > MAX_POINTS
      )
        return state;
      return {
        ...state,
        strokes: [...state.strokes, input.stroke],
        lastSeq: input.stroke.seq,
        lastStroke: input.stroke.id,
        checkedAt: event.now,
      };
    }
    if (input.type === 'undo' && state.strokes.length > 0) {
      const id = state.strokes.at(-1)!.id;
      return {
        ...state,
        strokes: state.strokes.filter((stroke) => stroke.id !== id),
        checkedAt: event.now,
      };
    }
    if (input.type === 'clear' && state.strokes.length > 0)
      return { ...state, strokes: [], checkedAt: event.now };
    return state;
  }
  if (input.type !== 'guess' || Object.hasOwn(state.solved, playerId) || !state.word) return state;
  const guesses = Object.hasOwn(state.guesses, playerId) ? state.guesses[playerId]! : [];
  const text = input.text.trim();
  if (!text || guesses.includes(text.toLowerCase())) return state;
  if (guesses.length >= MAX_GUESSES)
    return state.feedback[playerId] === 'limited'
      ? state
      : { ...state, feedback: { ...state.feedback, [playerId]: 'limited' } };
  const verdict = matchAnswer(text, { answer: state.word.text, accept: state.word.aliases }, 'en');
  const correct = verdict === 'exact' || verdict === 'stem';
  const solved = correct ? { ...state.solved, [playerId]: event.now } : state.solved;
  const after: State = {
    ...state,
    solved,
    checkedAt: event.now,
    guesses: { ...state.guesses, [playerId]: [...guesses, text.toLowerCase()] },
    feedback: {
      ...state.feedback,
      [playerId]: correct ? 'correct' : verdict === 'fuzzy' ? 'close' : 'wrong',
    },
  };
  return allSolved(after) ? next(after, event.now) : after;
}
