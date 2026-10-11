// The active artist privately picks; an idle artist gets the first seeded choice.
import { enterPhase, hasPlayer, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { choicesFor } from '../content';
import { CHOOSE_MS } from '../types';
import type { Input, State, Transition } from '../types';

export function enterChoose(state: State, now: number, turnIndex: number): State {
  const drawerId = state.order[turnIndex] ?? '';
  const [choices, rng] = choicesFor(state.rng, state.settings.difficulty, state.used);
  return enterPhase(
    {
      ...state,
      rng,
      drawerId,
      turnIndex,
      choices,
      word: null,
      hintIndices: [],
      hintLevel: 0,
      strokes: [],
      lastSeq: -1,
      lastStroke: -1,
      solved: {},
      guesses: {},
      feedback: {},
      lastPoints: {},
      eligibleAtStart: 0,
      began: now,
      endsAt: now,
      checkedAt: now,
    },
    'choose',
    now,
    CHOOSE_MS,
  );
}
export function reduceChoose(state: State, event: GameEvent<Input>, next: Transition): State {
  if (
    isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
  )
    return next(state, event.now);
  if (
    event.type !== 'input' ||
    event.input.type !== 'choose' ||
    !hasPlayer(state, event.playerId) ||
    event.playerId !== state.drawerId ||
    !state.players[event.playerId]?.connected ||
    event.now < state.phase.startedAt ||
    event.now >= (state.phase.deadline ?? Infinity)
  )
    return state;
  const word = state.choices[event.input.index];
  return word ? next({ ...state, word }, event.now) : state;
}
