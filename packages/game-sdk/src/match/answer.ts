// Typed answers against content (matchAnswer) and against each other (sameAnswer, groupAnswers):
// foundation §4.5-4.6 as corrected by FOUNDATION-AUDIT #29-#30 and ruling 16.
import { codePoints, digitRuns, osaDistance } from './distance';
import { normalize } from './normalize';
import { stemKey } from './stem';
import type { MatchItem, MatchLang, MatchLevel } from './types';

/** One text in every form the levels compare. */
interface Form {
  compact: string;
  stem: string;
  digits: string;
  length: number;
}

function formOf(text: string, lang: MatchLang): Form {
  const { norm, compact } = normalize(text, lang);
  return {
    compact,
    stem: stemKey(norm, lang),
    digits: digitRuns(compact),
    length: codePoints(compact),
  };
}

function formsOf(texts: readonly string[], lang: MatchLang): Form[] {
  return texts.map((text) => formOf(text, lang)).filter((form) => form.compact !== '');
}

/** Edits a fuzzy match may make, by the target's length in letters (spec §4.5). */
export function fuzzAllowance(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  if (length <= 11) return 2;
  return 3;
}

/**
 * How `input` matches `item`, checked in this order:
 * 1. equal to a `reject` by compact form or by stem → `none` ("puffins" for penguin);
 * 2. equal to the answer or an accept by compact form → `exact` ("Ice-Cream" = "ice cream");
 * 3. equal by stem → `stem` ("movies" = "movie");
 * 4. within the allowance of the answer or an accept (OSA distance, the smallest over all of
 *    them, only between forms with the same digits) → `fuzzy` — unless a reject is at least as
 *    close as that target ("hose" is one edit from horse and zero from its reject);
 * 5. otherwise `none`. Empty input (nothing left after normalizing) is always `none`.
 */
export function matchAnswer(input: string, item: MatchItem, lang: MatchLang): MatchLevel {
  const typed = formOf(input, lang);
  if (typed.compact === '') return 'none';
  const rejects = formsOf(item.reject ?? [], lang);
  if (rejects.some((r) => r.compact === typed.compact || r.stem === typed.stem)) return 'none';
  const targets = formsOf([item.answer, ...(item.accept ?? [])], lang);
  if (targets.some((t) => t.compact === typed.compact)) return 'exact';
  if (targets.some((t) => t.stem === typed.stem)) return 'stem';
  let best = Infinity;
  for (const target of targets) {
    const allowed = fuzzAllowance(target.length);
    if (allowed === 0 || target.digits !== typed.digits) continue;
    const d = osaDistance(typed.compact, target.compact, allowed);
    if (d <= allowed && d < best) best = d;
  }
  if (best === Infinity) return 'none';
  const nearReject = rejects.some((r) => osaDistance(typed.compact, r.compact, best) <= best);
  return nearReject ? 'none' : 'fuzzy';
}

function oneEditApart(a: Form, b: Form): boolean {
  return (
    a.length >= 6 &&
    b.length >= 6 &&
    a.digits === b.digits &&
    osaDistance(a.compact, b.compact, 1) <= 1
  );
}

function sameForm(a: Form, b: Form): boolean {
  if (a.compact === '' || b.compact === '') return false;
  return a.compact === b.compact || a.stem === b.stem || oneEditApart(a, b);
}

/**
 * One player's text against another's (spec §4.6): the same compact form, the same stems, or both
 * 6+ letters and one edit apart with the same digits. Empty texts are never the same.
 */
export function sameAnswer(a: string, b: string, lang: MatchLang): boolean {
  return sameForm(formOf(a, lang), formOf(b, lang));
}

/**
 * Groups texts that mean the same answer (#30). `sameAnswer` is not transitive ("penguins" ~
 * "penguin" by stem, "penguin" ~ "pengiun" by one edit, yet "penguins" ≁ "pengiun"), so a group
 * is every text a chain of `sameAnswer` links reaches: compact and stem buckets first, then
 * union-find on one edit. Returns indices into `entries`, each group in submission order and the
 * groups ordered by their first member, so the result never depends on anything but the order
 * the texts arrived in. Empty texts stand alone.
 */
export function groupAnswers(entries: readonly string[], lang: MatchLang): number[][] {
  const forms = entries.map((text) => formOf(text, lang));
  const parent = forms.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root] as number;
    return root;
  };
  // The smaller index stays the root, so a group is named by its first submission.
  const union = (i: number, j: number): void => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  };
  const byCompact = new Map<string, number>();
  const byStem = new Map<string, number>();
  forms.forEach((form, i) => {
    if (form.compact === '') return;
    for (const [bucket, key] of [
      [byCompact, form.compact],
      [byStem, form.stem],
    ] as const) {
      const first = bucket.get(key);
      if (first === undefined) bucket.set(key, i);
      else union(first, i);
    }
  });
  for (let i = 0; i < forms.length; i++)
    for (let j = i + 1; j < forms.length; j++) {
      const a = forms[i] as Form;
      const b = forms[j] as Form;
      if (a.compact !== '' && b.compact !== '' && find(i) !== find(j) && oneEditApart(a, b))
        union(i, j);
    }
  const groups = new Map<number, number[]>();
  forms.forEach((_, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(i);
    else groups.set(root, [i]);
  });
  return [...groups.values()];
}
