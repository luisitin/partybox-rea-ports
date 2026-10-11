// The owner's pacing rule (owner decision cc45f4, 2026-09-25, docs/GAME_CONTRACT.md): "Enough time to read".
// One reading-time rule for every game. Pure and server-safe (no zod, no React).

/** A screen with words stays up at least this long. */
export const READ_BASE_MS = 1_500;
/** A slow reader: a word every 1/3 s. Kept at 333 (not 333.33…) so every game's existing
 *  timing stays byte-identical to the per-game copies this replaced. */
export const READ_PER_WORD_MS = 333;
/** Screens in the UI's own words (translated, may wrap at 200 % text). */
export const READ_UI_FACTOR = 1.3;
export const READ_ES_FACTOR = 1.1;
export const READ_LARGE_TEXT_FACTOR = 1.2;

export interface ReadingOpts {
  /** The screen is in the UI's own words (x1.3); deck/content text is not. */
  ui?: boolean;
  /** The reader's language; Spanish ('es…') reads longer (x1.1). */
  lang?: string;
  /** The reader uses large text (x1.2). */
  largeText?: boolean;
}

/** How long (ms) `words` words take a slow reader. */
export function readingMs(words: number, opts: ReadingOpts = {}): number {
  const base = Math.max(READ_BASE_MS, READ_BASE_MS + words * READ_PER_WORD_MS);
  let factor = opts.ui ? READ_UI_FACTOR : 1;
  if (opts.lang?.toLowerCase().startsWith('es')) factor *= READ_ES_FACTOR;
  if (opts.largeText) factor *= READ_LARGE_TEXT_FACTOR;
  return Math.round(base * factor);
}

/** Whitespace-separated words in `text` (empty runs ignored). */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}
