// isLegalClue: may a player give this clue for this secret? (foundation §4.7 as corrected by
// FOUNDATION-AUDIT #31 and ruling 16). Returns reason codes only: the game owns the words the
// player sees, in both languages. The phone runs it as the player types; the server runs it again.
import { matchAnswer } from './answer';
import { codePoints } from './distance';
import { normalize } from './normalize';
import type { MatchItem, MatchLang } from './types';

export type ClueReason = 'empty' | 'too-long' | 'not-one-word' | 'is-secret' | 'contains-secret';
export type ClueVerdict = { ok: true } | { ok: false; reason: ClueReason };

export interface ClueOptions {
  /** The secret's content language (ruling 15). */
  lang: MatchLang;
  /** Longest clue in code points of the raw trimmed text. Default `CLUE_MAX_CHARS`. */
  maxChars?: number;
  /** Reject whitespace inside the clue. A hyphenated clue ("ice-cream") is one word. */
  oneWord?: boolean;
}

export const CLUE_MAX_CHARS = 20;

/** Shortest clue that counts as "inside the secret" ("flower" in sunflower; "sun" is too short). */
const INSIDE_SECRET_MIN = 4;
/** Shortest `family` root checked inside a clue (the schema also asks for 3+). */
const FAMILY_MIN = 3;

const OK: ClueVerdict = { ok: true };
const fail = (reason: ClueReason): ClueVerdict => ({ ok: false, reason });

/**
 * Checks, in order: `empty` (nothing left after normalizing); `too-long` (more than `maxChars`
 * code points, counted on the raw trimmed text so the phone's counter agrees); `not-one-word`
 * (with `oneWord`, whitespace inside the raw text); `is-secret` (`matchAnswer` says `stem` or
 * better); `contains-secret` (the compact clue contains the compact answer or a 3+ letter
 * `family` root, or the compact answer contains a clue of 4+ letters).
 *
 * Pass `secret: null` for a player who does not know the secret: the secret-based checks would
 * tell them their clue is close (§4.7), so only the first three run.
 */
export function isLegalClue(
  clue: string,
  secret: MatchItem | null,
  opts: ClueOptions,
): ClueVerdict {
  const raw = clue.trim();
  const { compact } = normalize(raw, opts.lang);
  if (compact === '') return fail('empty');
  if (codePoints(raw) > (opts.maxChars ?? CLUE_MAX_CHARS)) return fail('too-long');
  if (opts.oneWord && /\s/.test(raw)) return fail('not-one-word');
  if (secret === null) return OK;
  const level = matchAnswer(raw, secret, opts.lang);
  if (level === 'exact' || level === 'stem') return fail('is-secret');
  const answer = normalize(secret.answer, opts.lang).compact;
  const roots = (secret.family ?? [])
    .map((root) => normalize(root, opts.lang).compact)
    .filter((root) => codePoints(root) >= FAMILY_MIN);
  if (
    (answer !== '' && compact.includes(answer)) ||
    roots.some((root) => compact.includes(root)) ||
    (codePoints(compact) >= INSIDE_SECRET_MIN && answer.includes(compact))
  )
    return fail('contains-secret');
  return OK;
}
