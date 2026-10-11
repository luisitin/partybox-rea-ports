// The artist privately chooses a word. Eight seconds later the first option is selected.
import { enterPhase, shuffle, isTimerFor, hasPlayer } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { vocabulary } from '../content';
import { BOT_ART } from '../pictures';
import { CHOOSE_MS } from '../types';
import type { State, Input, Transition } from '../types';
export function enterChoose(state: State, now: number, turn: number): State {
  const drawer = state.order[turn] ?? '';
  const words = vocabulary(state.settings.difficulty);
  const bot = state.players[drawer]?.bot;
  const suitable = words.filter(
    (word) => (!bot || Object.hasOwn(BOT_ART, word)) && !state.used.includes(word),
  );
  const fallback = words.filter((word) => !bot || Object.hasOwn(BOT_ART, word));
  const [deck, rng] = shuffle(state.rng, suitable.length >= 3 ? suitable : fallback);
  return enterPhase(
    {
      ...state,
      turn,
      drawer,
      choices: deck.slice(0, 3),
      rng,
      word: '',
      strokes: [],
      solved: {},
      guesses: {},
      feedback: {},
      lastGuessAt: {},
      gains: {},
      hintOrder: [],
      hintCount: 0,
      began: now,
      endsAt: now + CHOOSE_MS,
      clock: now,
    },
    'choose',
    now,
    CHOOSE_MS,
  );
}
export function reduceChoose(state: State, event: GameEvent<Input>, next: Transition): State {
  if (isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity))
    return next(state, event.now);
  if (
    event.type !== 'input' ||
    event.input.type !== 'choose' ||
    event.playerId !== state.drawer ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]?.connected ||
    event.now < state.phase.startedAt ||
    event.now >= state.endsAt
  )
    return state;
  const word = state.choices[event.input.index];
  return word ? next({ ...state, word }, event.now) : state;
}
