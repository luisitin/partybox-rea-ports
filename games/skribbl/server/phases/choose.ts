// The artist privately chooses a word. Eight seconds later the first option is selected.
import { enterPhase, shuffle, isTimerFor, hasPlayer } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { vocabulary } from '../content';
import { BOT_ART } from '../pictures';
import { CHOOSE_MS } from '../types';
import type { State, Input, Transition } from '../types';

function wordHand(state: State, bot: boolean): [string[], State['rng']] {
  const eligible = (words: readonly string[]): string[] =>
    words.filter((word) => !bot || Object.hasOwn(BOT_ART, word));
  if (state.settings.difficulty === 'mixed') {
    let rng = state.rng;
    const hand: string[] = [];
    // Every artist gets the same range of choices, independent of a lucky difficulty deal.
    for (const tier of ['easy', 'medium', 'hard']) {
      const pool = eligible(vocabulary(tier));
      const unused = pool.filter((word) => !state.used.includes(word));
      const [deck, nextRng] = shuffle(rng, unused.length ? unused : pool);
      rng = nextRng;
      hand.push(...deck.slice(0, 1));
    }
    return shuffle(rng, hand);
  }
  const pool = eligible(vocabulary(state.settings.difficulty));
  const unused = pool.filter((word) => !state.used.includes(word));
  const [deck, rng] = shuffle(state.rng, unused.length >= 3 ? unused : pool);
  return [deck.slice(0, 3), rng];
}

export function enterChoose(state: State, now: number, turn: number): State {
  const drawer = state.order[turn] ?? '';
  const [choices, rng] = wordHand(state, Boolean(state.players[drawer]?.bot));
  return enterPhase(
    {
      ...state,
      turn,
      drawer,
      choices,
      rng,
      word: '',
      strokes: [],
      inkRevision: 0,
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
