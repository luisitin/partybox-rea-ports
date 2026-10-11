// Each seat advances independently; question id and cursor reject delayed duplicate taps.
import { hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { answerPoints } from '../scoring';
import { BEAT_MS, FREEZE_MS } from '../types';
import type { Input, Runner, State, Transition } from '../types';

export function raceComplete(state: State): boolean {
  return Object.values(state.players)
    .filter((p) => p.connected && !state.left.includes(p.id))
    .every((p) => (state.runners[p.id]?.answered ?? 0) >= state.deck.length);
}
export function beatRace(state: State, now: number, next: Transition): State {
  if (now >= state.endsAt || raceComplete(state)) return next({ ...state, clock: now }, now);
  return nextStep({ ...state, clock: now }, Math.min(state.endsAt, now + BEAT_MS));
}

// Inputs and resume may overtake a queued beat. Keep a future deadline for the host scheduler.
export function rearmRaceBeat(state: State): State {
  return state.phase.id === 'race' && (state.phase.deadline ?? Infinity) < state.clock
    ? nextStep(state, Math.min(state.endsAt, state.clock + BEAT_MS))
    : state;
}

function usePower(
  state: State,
  id: string,
  input: Extract<Input, { type: 'power' }>,
  now: number,
): State {
  const runner = state.runners[id]!;
  if (!state.cfg.powers || runner.energy < 1) return state;
  if (input.power === 'double') {
    if (runner.double) return state;
    return {
      ...state,
      clock: now,
      runners: { ...state.runners, [id]: { ...runner, energy: 0, double: true } },
    };
  }
  const target = input.target ?? '';
  if (
    target === id ||
    !hasPlayer(state, target) ||
    !state.players[target]?.connected ||
    state.left.includes(target)
  )
    return state;
  const rival = state.runners[target]!;
  if (rival.answered >= state.deck.length || rival.freezeUntil > now) return state;
  return {
    ...state,
    clock: now,
    runners: {
      ...state.runners,
      [id]: { ...runner, energy: 0 },
      [target]: { ...rival, freezeUntil: now + FREEZE_MS },
    },
  };
}

export function reduceRace(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) &&
      event.now >= Math.max(state.clock, state.phase.deadline ?? Infinity)
      ? beatRace(state, event.now, next)
      : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected ||
    state.left.includes(event.playerId)
  )
    return state;
  if (event.now < state.clock || event.now < state.began) return state;
  if (event.now >= state.endsAt) return next({ ...state, clock: event.now }, event.now);
  const id = event.playerId;
  const runner = state.runners[id]!;
  if (runner.answered >= state.deck.length || runner.freezeUntil > event.now) return state;
  const input = event.input;
  if (input.type === 'power') return rearmRaceBeat(usePower(state, id, input, event.now));
  if (input.type === 'next') {
    if (!runner.feedback || input.index !== runner.answered) return state;
    return rearmRaceBeat({
      ...state,
      clock: event.now,
      runners: { ...state.runners, [id]: { ...runner, feedback: null } },
    });
  }
  const question = state.deck[runner.answered];
  if (
    !question ||
    runner.feedback ||
    input.index !== runner.answered ||
    input.questionId !== question.id
  )
    return state;
  const correct = input.choice === question.correctIndex;
  const streak = correct ? runner.streak + 1 : 0;
  const points = answerPoints(correct, streak, runner.double);
  const updated: Runner = {
    ...runner,
    answered: runner.answered + 1,
    correct: runner.correct + Number(correct),
    score: runner.score + points,
    streak,
    energy: state.cfg.powers && correct && (runner.correct + 1) % 3 === 0 ? 1 : runner.energy,
    double: correct ? false : runner.double,
    feedback: {
      correct,
      points,
      answer: question.options[question.correctIndex]!,
      explanation: question.explanation,
    },
  };
  const after = { ...state, clock: event.now, runners: { ...state.runners, [id]: updated } };
  return raceComplete(after) ? next(after, event.now) : rearmRaceBeat(after);
}
