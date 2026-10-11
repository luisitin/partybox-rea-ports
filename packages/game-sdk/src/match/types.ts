// Types shared by the matcher's files (kept apart so the files never import each other in a loop).

/** The language of the content a text is compared against (ruling 15: every answer pack carries
 *  a required `lang`, and every match function takes it explicitly). */
export type MatchLang = 'en' | 'es';

/** What `matchAnswer` found. Each game picks the lowest level it accepts (guesses: `fuzzy`). */
export type MatchLevel = 'exact' | 'stem' | 'fuzzy' | 'none';

/**
 * Anything a player might type, with its variants (foundation §4.2, `answer-item.schema.json`).
 * A pack item (`AnswerItem`, which also has an `id`) is one; a secret without variants is
 * `{ answer }`.
 */
export interface MatchItem {
  /** The display form. */
  answer: string;
  /** Counts as the same answer: plurals, misspellings, synonyms. */
  accept?: readonly string[];
  /** Looks close but is wrong: blocks exact, stem and fuzzy matches (#29). */
  reject?: readonly string[];
  /** Word games only: roots that give the secret away as a clue (sunflower → sun, flower). */
  family?: readonly string[];
}
