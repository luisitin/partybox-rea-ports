// Typed access to content/questions.json. Imported statically (bundled, no I/O); parsed once at
// module load so a broken pack fails at import time and in the contract suite, never mid-game.
import {
  CATEGORIES,
  SUBCATEGORIES,
  labelOf,
  questionsEsPackSchema,
  questionsPackSchema,
} from '../content/schema';
import type { Category, Question } from '../content/schema';
import questionsEsJson from '../content/questions.es.json' with { type: 'json' };
import questionsJson from '../content/questions.json' with { type: 'json' };

export type ContentLang = 'en' | 'es';

export const QUESTIONS: readonly Question[] = questionsPackSchema.parse(questionsJson).items;
/** ADR-054: the Spanish deck — the English ids it translates, ES-only "<id>-es" replacements, and
 *  the English ids it drops (questions about English itself). */
const ES_PACK = questionsEsPackSchema.parse(questionsEsJson);
export const QUESTIONS_ES: readonly Question[] = ES_PACK.items;
export const DROPPED_ES: readonly string[] = ES_PACK.dropped;

const byId = (qs: readonly Question[]): Readonly<Record<string, Question>> =>
  Object.fromEntries(qs.map((q) => [q.id, q]));
const BY_ID = byId(QUESTIONS);
const BY_ID_ES = byId(QUESTIONS_ES);

/** The whole deck in a game's content language (absent = English). */
export function questionsOf(lang?: ContentLang): readonly Question[] {
  return lang === 'es' ? QUESTIONS_ES : QUESTIONS;
}

export function questionById(id: string, lang?: ContentLang): Question | undefined {
  const table = lang === 'es' ? BY_ID_ES : BY_ID;
  return Object.hasOwn(table, id) ? table[id] : undefined;
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** The topic ids of a category (empty for `all` or an unknown category). */
export function subcategoriesOf(category: string): readonly string[] {
  return isCategory(category) ? SUBCATEGORIES[category] : [];
}

/**
 * Questions of one category, in pack order (empty for an unknown category); with `subcategories`,
 * only those topics.
 */
export function questionsIn(
  category: string,
  subcategories: readonly string[] = [],
  lang?: ContentLang,
): readonly Question[] {
  return questionsOf(lang).filter(
    (q) =>
      q.category === category &&
      (subcategories.length === 0 || subcategories.includes(q.subcategory)),
  );
}

/** Human label for a category id or `all` (the manifest's select labels, without importing it). */
export function categoryLabel(category: string): string {
  return labelOf(category);
}

/** "Sports · Basketball, Soccer" — what the intro pill says the game draws from. */
export function drawLabel(category: string, subcategories: readonly string[]): string {
  const head = labelOf(category);
  return subcategories.length === 0 ? head : `${head} · ${subcategories.map(labelOf).join(', ')}`;
}
