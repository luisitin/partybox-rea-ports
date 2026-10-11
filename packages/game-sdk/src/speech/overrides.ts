// Pronunciation overrides (Part 00 §5.4, audit #17/#21, the owner's ruling 17): the SDK's global
// list (overrides.en.json) and a game's own (content/pronunciations.json, which wins). The schema is
// a superset of Blanks' lexicon (games/blanks/content/pronounce.json): words, per-item fixes
// (`items`, or Blanks' `cards`, with `_whole` for an item's whole text) and regex patterns, each
// entry saying, spelling or giving phonemes. Words match whole and CASE-SENSITIVELY — a fix for
// "US" must never touch "us" — unless the entry says `anyCase: true`. Pure.
import type { SpeechPart } from '@partybox/shared';
import { z } from '@partybox/shared';

const isRegex = (source: string): boolean => {
  try {
    new RegExp(source, 'u');
    return true;
  } catch {
    return false;
  }
};

const entrySchema = z
  .strictObject({
    /** What every voice reads instead: a plain lowercase respelling ("keen-wah") — espeak spells
     *  a capitalised syllable ("YON") letter by letter. */
    say: z.string().min(1).optional(),
    /** Kokoro phonemes (espeak notation), said as given; Zira reads `say`, else the word. */
    ipa: z.string().min(1).optional(),
    /** Part 00's name for `ipa`, accepted and read as `ipa`. */
    phonemes: z.string().min(1).optional(),
    /** Letter by letter ("AITA" → "A I T A"). */
    spell: z.boolean().optional(),
    /** Match any case ("quinoa", "Quinoa", "QUINOA"); the default is the exact case. */
    anyCase: z.boolean().optional(),
    /** Why the entry exists (not read). */
    why: z.string().optional(),
  })
  .refine((e) => !(e.ipa && e.phonemes), { message: 'give ipa or phonemes, not both' })
  .refine((e) => Boolean(e.say ?? e.ipa ?? e.phonemes ?? e.spell), {
    message: 'an entry needs say, ipa (phonemes) or spell',
  });

const patternSchema = z.strictObject({
  /** A regular expression (JavaScript, `u` flag) over what the word lists left. */
  match: z.string().min(1).refine(isRegex, { message: 'not a valid regular expression' }),
  /** The replacement; `$1`… are the groups. */
  say: z.string(),
  anyCase: z.boolean().optional(),
  why: z.string().optional(),
});

const itemsSchema = z.record(z.string().min(1), z.record(z.string().min(1), entrySchema));

export const pronunciationsSchema = z.strictObject({
  _about: z.string().optional(),
  words: z.record(z.string().min(1), entrySchema).optional(),
  patterns: z.array(patternSchema).optional(),
  /** Fixes for one content item (card, prompt, question) by its id; `_whole` replaces its text. */
  items: itemsSchema.optional(),
  /** Blanks' name for `items`. */
  cards: itemsSchema.optional(),
});
export type PronunciationsFile = z.infer<typeof pronunciationsSchema>;

/** One entry, `phonemes` folded into `ipa`. */
export interface Override {
  say?: string;
  ipa?: string;
  spell?: boolean;
}

interface WordList {
  exact: RegExp | null;
  folded: RegExp | null;
  byKey: ReadonlyMap<string, Override>;
  byFolded: ReadonlyMap<string, Override>;
}

/** A validated, compiled list for `toSpeakable({ overrides })`: parse it once, at module level. */
export interface Pronunciations {
  readonly words: WordList;
  readonly items: ReadonlyMap<string, { list: WordList; whole?: Override }>;
  readonly patterns: readonly { re: RegExp; say: string }[];
}

// Syntax characters only: the `u` flag rejects any other escaped character ("\-").
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Whole words: nothing word-like before (a quote's apostrophe is fine, O'Brien's is not) and
 *  nothing after but a possessive 's or ' — "Harambe" matches "Harambe's", "don" not "don't". */
function wordRegex(keys: readonly string[], anyCase: boolean): RegExp | null {
  if (keys.length === 0) return null;
  const alts = [...keys]
    .sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
    .map(escape)
    .join('|');
  const source = `(?<![\\p{L}\\p{N}_])(?<!\\p{L}')(?:${alts})(?![\\p{L}\\p{N}_])(?!'(?!s?(?![\\p{L}\\p{N}])))`;
  return new RegExp(source, anyCase ? 'giu' : 'gu');
}

const normal = (e: z.infer<typeof entrySchema>): Override => {
  const ipa = e.ipa ?? e.phonemes;
  return {
    ...(e.say !== undefined && { say: e.say }),
    ...(ipa !== undefined && { ipa }),
    ...(e.spell !== undefined && { spell: e.spell }),
  };
};

function compileWords(words: Readonly<Record<string, z.infer<typeof entrySchema>>>): WordList {
  const byKey = new Map<string, Override>();
  const byFolded = new Map<string, Override>();
  for (const [key, entry] of Object.entries(words)) {
    if (key === '_whole') continue;
    byKey.set(key, normal(entry));
    if (entry.anyCase) byFolded.set(key.toLowerCase(), normal(entry));
  }
  return {
    exact: wordRegex([...byKey.keys()], false),
    folded: wordRegex([...byFolded.keys()], true),
    byKey,
    byFolded,
  };
}

/** Validates (throws the zod error on a bad file — a content bug, caught by its pack test) and
 *  compiles a pronunciations file. */
export function parsePronunciations(json: unknown): Pronunciations {
  const file = pronunciationsSchema.parse(json);
  const items = new Map<string, { list: WordList; whole?: Override }>();
  for (const [id, words] of Object.entries({ ...file.cards, ...file.items })) {
    const whole = words['_whole'];
    items.set(id, { list: compileWords(words), ...(whole && { whole: normal(whole) }) });
  }
  return {
    words: compileWords(file.words ?? {}),
    items,
    patterns: (file.patterns ?? []).map((p) => ({
      re: new RegExp(p.match, p.anyCase ? 'giu' : 'gu'),
      say: p.say,
    })),
  };
}

/** How the pipeline freezes a match: `freeze` stores the parts and returns their placeholder. */
export type Freeze = (parts: readonly SpeechPart[] | string) => string;
export type Render = (entry: Override, word: string) => readonly SpeechPart[];

/** Every whole-word match of `list` in `text`, frozen: exact-case entries first, then anyCase. */
export function applyWords(text: string, list: WordList, render: Render, freeze: Freeze): string {
  let out = text;
  if (list.exact) out = out.replace(list.exact, (m) => freeze(render(list.byKey.get(m)!, m)));
  if (list.folded)
    out = out.replace(list.folded, (m) => freeze(render(list.byFolded.get(m.toLowerCase())!, m)));
  return out;
}

/** A pattern's replacement with `$1`…`$9` and `$&` filled in, frozen as said text. */
export function applyPatterns(
  text: string,
  patterns: Pronunciations['patterns'],
  freeze: Freeze,
): string {
  return patterns.reduce(
    (t, p) =>
      t.replace(p.re, (...args: unknown[]) => {
        // (match, ...groups, offset, input[, named]): the groups end at the first number.
        const groups = args.slice(
          1,
          args.findIndex((a, i) => i > 0 && typeof a === 'number'),
        );
        const said = p.say.replace(/\$(&|\d)/g, (_, g: string) =>
          String((g === '&' ? args[0] : groups[Number(g) - 1]) ?? ''),
        );
        return freeze(said);
      }),
    text,
  );
}
