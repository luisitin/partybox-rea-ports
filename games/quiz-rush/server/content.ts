// Read validated original packs and shuffle questions and shape assignments once per match.
import { shuffle } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import general from '../content/general.json' with { type: 'json' };
import movies from '../content/movies.json' with { type: 'json' };
import science from '../content/science.json' with { type: 'json' };
import { packSchema } from '../content/schema';
import type { Question } from '../content/schema';
import type { PublicQuestion } from './views';
import type { State } from './types';

const PACKS = {
  general: packSchema.parse(general),
  movies: packSchema.parse(movies),
  science: packSchema.parse(science),
};

export function makeDeck(pack: string, rounds: number, rng: RngState): [Question[], RngState] {
  const source = Object.hasOwn(PACKS, pack) ? PACKS[pack as keyof typeof PACKS] : PACKS.general;
  const [questions, after] = shuffle(rng, source.questions);
  let next = after;
  const deck = questions.slice(0, rounds).map((q): Question => {
    const [order, r] = shuffle(next, [0, 1, 2, 3]);
    next = r;
    const options = order.map((i) => q.options[i]!) as Question['options'];
    return { ...q, options, correct: order.indexOf(q.correct) };
  });
  return [deck, next];
}

export function currentQuestion(state: State): Question {
  return state.deck[state.round - 1]!;
}

export function publicQuestion(state: State): PublicQuestion {
  const q = currentQuestion(state);
  return { id: q.id, prompt: q.prompt, options: [...q.options] };
}
