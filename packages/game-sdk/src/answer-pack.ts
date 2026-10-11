// Answer packs: the schema for anything a player might type (foundation §4.2,
// docs/game-pack/schemas/answer-item.schema.json) and the pack test of §4.9 (FOUNDATION-AUDIT #28).
// Exported from the pure server entry, not from `./match`: zod must stay off phones (ADR-050).
import { z } from '@partybox/shared';
import { matchAnswer } from './match/answer';
import { normalize } from './match/normalize';

const lowercase = (min: number): z.ZodString =>
  z
    .string()
    .min(min)
    .refine((text) => text === text.toLowerCase(), 'must be lowercase');

/** A pack's content language (ruling 15): every match function is called with it. */
export const answerLangSchema = z.enum(['en', 'es']);

/** One answer and its variants. Unknown fields (a game's `clues`, `weight`…) pass through. */
export const answerItemSchema = z.looseObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are lowercase words joined by hyphens'),
  answer: lowercase(1),
  accept: z.array(lowercase(1)).default([]),
  reject: z.array(lowercase(1)).default([]),
  family: z.array(lowercase(3)).default([]),
});

/** What `checkAnswerPack` reads: a language and the items that must not clash with each other. */
export const answerPackSchema = z.object({
  lang: answerLangSchema,
  items: z.array(answerItemSchema),
});

export type AnswerItem = z.output<typeof answerItemSchema>;
export type AnswerPack = z.output<typeof answerPackSchema>;

export interface AnswerPackReport {
  ok: boolean;
  /** Each one fails the pack test. */
  errors: string[];
  /** Worth fixing, never fatal: a common word with fewer than 3 accepted forms. */
  warnings: string[];
}

export interface AnswerPackOptions {
  /** Which items are common words, held to "3+ accepted forms" (default: every item). */
  isCommon?: (item: AnswerItem) => boolean;
}

/** Common words want six or more accepted forms (§4.2); the pack test warns under three. */
const MIN_COMMON_ACCEPTS = 3;

/**
 * The §4.9 pack test. Fails on a schema error, on a repeated id, on two entries (answers and
 * accepts, across the whole pack) equal after normalization — compared on the compact form
 * (#28), so spacing, case, accent and apostrophe variants are automatic and must not be listed —
 * on an entry that normalizes to nothing, and on an answer or accept that does not match its own
 * item as `exact` (a reject that blocks it, say). Warns on common items with under 3 accepts.
 * Pass the items that must stay apart: a whole word list, or one question's answers.
 */
export function checkAnswerPack(pack: unknown, options: AnswerPackOptions = {}): AnswerPackReport {
  const parsed = answerPackSchema.safeParse(pack);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(pack)'}: ${issue.message}`,
    );
    return { ok: false, errors, warnings: [] };
  }
  const { lang, items } = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const seen = new Map<string, string>();
  for (const item of items) {
    if (ids.has(item.id)) errors.push(`${item.id}: the id is used twice`);
    ids.add(item.id);
    for (const [field, text] of [
      ['answer', item.answer] as const,
      ...item.accept.map((a) => ['accept', a] as const),
    ]) {
      const where = `${item.id} ${field} "${text}"`;
      const { compact } = normalize(text, lang);
      if (compact === '') {
        errors.push(`${where} is empty after normalization`);
        continue;
      }
      const first = seen.get(compact);
      if (first !== undefined)
        errors.push(
          `${where} equals ${first} after normalization ("${compact}"): spacing, case, accent and apostrophe variants are automatic`,
        );
      else seen.set(compact, where);
      const level = matchAnswer(text, item, lang);
      if (level !== 'exact')
        errors.push(`${where} matches its own item as "${level}", not "exact"`);
    }
    if ((options.isCommon?.(item) ?? true) && item.accept.length < MIN_COMMON_ACCEPTS)
      warnings.push(
        `${item.id}: "${item.answer}" has ${item.accept.length} accepted form(s); a common word wants 6 or more`,
      );
  }
  return { ok: errors.length === 0, errors, warnings };
}
