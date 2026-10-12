import { shuffle, type RngState } from '@partybox/game-sdk';
import general from '../content/general.json';
import movies from '../content/movies.json';
import science from '../content/science.json';
import { packs, type Question, type QuestionPack } from '../content/schema';

// Validate trusted, bundled content once; reducers only use the parsed data.
export const PACKS: Readonly<Record<string, QuestionPack>> = {
  general: packs.general.parse(general),
  movies: packs.movies.parse(movies),
  science: packs.science.parse(science),
};

/** One seeded order shared by the whole room, with no repeats inside a race. */
export function chooseQuestions(
  pack: string,
  count: number,
  rng: RngState,
): [Question[], RngState] {
  const source = Object.hasOwn(PACKS, pack) ? PACKS[pack] : PACKS.general;
  const [questions, nextRng] = shuffle(rng, source!.questions);
  const length = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return [
    questions.slice(0, length).map((question) => ({
      ...question,
      options: [...question.options] as Question['options'],
    })),
    nextRng,
  ];
}
