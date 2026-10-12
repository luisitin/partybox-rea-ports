// Drawing the question list: seeded, without repeats, category- and topic-filtered with fallbacks,
// and a final question that prefers the hardest difficulty still available (README "Content").
import { drawFromDeck } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import type { Difficulty, Question } from '../content/schema';
import { questionsIn, questionsOf } from './content';
import type { ContentLang } from './content';

export interface Draw {
  ids: string[];
  /** `all` or the category actually used (the setting falls back to `all` when too small). */
  drawnFrom: string;
  /** The topics actually used (empty = the whole category, or after a fallback). */
  drawnSubs: string[];
}

const HARDEST_FIRST: readonly Difficulty[] = ['hard', 'medium', 'easy'];

/**
 * The pool a game draws from: the ticked topics of the chosen category if they hold
 * `questions + 1` items, else the whole category if it does, else everything — all in the game's
 * content language (ADR-054: the Spanish deck lacks the dropped English ids, so its counts are its own).
 */
export function poolFor(
  category: string,
  subcategories: readonly string[],
  questions: number,
  lang?: ContentLang,
): { pool: readonly Question[]; from: string; subs: string[] } {
  if (category !== 'all') {
    if (subcategories.length > 0) {
      const topics = questionsIn(category, subcategories, lang);
      if (topics.length >= questions + 1)
        return { pool: topics, from: category, subs: [...subcategories] };
    }
    const pool = questionsIn(category, [], lang);
    if (pool.length >= questions + 1) return { pool, from: category, subs: [] };
  }
  return { pool: questionsOf(lang), from: 'all', subs: [] };
}

export function drawQuestions(
  rng: RngState,
  category: string,
  questions: number,
  subcategories: readonly string[] = [],
  lang?: ContentLang,
): [Draw, RngState] {
  const { pool, from, subs } = poolFor(category, subcategories, questions, lang);
  // Never more regular questions than leave one for the final (the pack guarantees >= 200 anyway;
  // at least 5 are drawn, so the pool is always shuffled).
  const regularCount = Math.max(0, Math.min(questions, pool.length - 1));
  const { drawn: regular, deck: rest, rng: next } = drawFromDeck(rng, [], regularCount, pool);
  const final =
    HARDEST_FIRST.map((d) => rest.find((q) => q.difficulty === d)).find((q) => q !== undefined) ??
    rest[0];
  const ids = regular.map((q) => q.id);
  if (final) ids.push(final.id);
  return [{ ids, drawnFrom: from, drawnSubs: subs }, next];
}
