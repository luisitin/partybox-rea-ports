// A game's reader voice in one place (audit #7): the room's voice setting, the game's id, language
// and pronunciations, so a line is one call; then what every `speech(state)` does with its wanted
// list (drop the made ones, dedupe, cap) and what a view asks of a made reading. Pure.
import type { SpeechPart, SpeechRequest } from '@partybox/shared';
import { speechKey } from './key';
import type { Pronunciations } from './overrides';
import { toSpeakable } from './speakable';

/** What the host has made so far: key → length in ms, -1 when it failed (`state.speechMs`). */
export type SpeechLengths = Readonly<Record<string, number>>;

export interface ReaderOptions {
  /** The lines' language (default 'en'). */
  lang?: 'en' | 'es';
  /** The game's own pronunciations (`parsePronunciations` of its content file). */
  overrides?: Pronunciations;
}

export interface LineOptions {
  /** A player's words: toSpeakable's player-text rules (a shout calmed, a stretch cut, a cap). */
  playerText?: boolean;
  /** The content item the line reads, for that item's own pronunciations. */
  itemId?: string;
}

export interface Reader {
  readonly voice: string;
  /** `text` through toSpeakable under the game's key. Its parts are empty when nothing is left to
   *  say (emoji only): a game that should not ask for such a line checks `parts.length`. */
  line(text: string, opts?: LineOptions): SpeechRequest;
  /** Parts the game made itself (its own rewrite), under the game's key. */
  parts(parts: SpeechPart[]): SpeechRequest;
}

/**
 * One line in `voice` (a reader voice, never 'none'): `text` through toSpeakable, under
 * `speechKey(gameId, voice, parts)`. For a game that already holds the voice; `reader` otherwise.
 */
export function speechLine(
  gameId: string,
  voice: string,
  text: string,
  opts: ReaderOptions & LineOptions = {},
): SpeechRequest {
  const parts = toSpeakable(text, {
    voice,
    lang: opts.lang ?? 'en',
    ...(opts.overrides ? { overrides: opts.overrides } : {}),
    ...(opts.itemId !== undefined ? { itemId: opts.itemId } : {}),
    ...(opts.playerText ? { playerText: true } : {}),
  });
  return { key: speechKey(gameId, voice, parts), voice, parts };
}

/**
 * The room's reader for `gameId`, or null when nobody reads aloud (`voice` is 'none' or unset).
 * Keys are `speechKey(gameId, voice, parts)`, so a line keeps its key whichever helper built it.
 */
export function reader(
  gameId: string,
  voice: string | null | undefined,
  opts: ReaderOptions = {},
): Reader | null {
  if (!voice || voice === 'none') return null;
  return {
    voice,
    line: (text, line = {}) => speechLine(gameId, voice, text, { ...opts, ...line }),
    parts: (parts) => ({ key: speechKey(gameId, voice, parts), voice, parts }),
  };
}

/**
 * What `speech(state)` returns (ADR-045, Part 00 §5.7): the wanted readings in order, without the
 * nulls, the ones the host has made (or failed) and repeats, at most `max` of them
 * (`pendingCap(players)` for most games).
 */
export function drainSpeech(
  wanted: readonly (SpeechRequest | null | undefined)[],
  made: SpeechLengths,
  max: number,
): SpeechRequest[] {
  const seen = new Set<string>();
  const out: SpeechRequest[] = [];
  for (const r of wanted) {
    if (out.length >= max) break;
    if (!r || seen.has(r.key) || made[r.key] !== undefined) continue;
    seen.add(r.key);
    out.push(r);
  }
  return out;
}

/** A reading's length: ms once made, -1 when it failed, undefined while it is being made. */
export function madeMs(
  made: SpeechLengths,
  req: SpeechRequest | null | undefined,
): number | undefined {
  return req ? made[req.key] : undefined;
}

/** Where the host serves a key's audio. */
export function speechUrl(key: string): string {
  return `/api/speech/${key}.wav`;
}

/** What a view carries for a reading that can play now (made, not failed), else null. A key
 *  reaches a view only at the moment its line plays: never put a later line's here. */
export function playable(
  made: SpeechLengths,
  req: SpeechRequest | null | undefined,
): { key: string; url: string } | null {
  const ms = madeMs(made, req);
  return req && ms !== undefined && ms >= 0 ? { key: req.key, url: speechUrl(req.key) } : null;
}

/**
 * T-0144: a speech catalog's readings (`GameDefinition.speechCatalog`) without the nulls, the
 * empty ones (nothing left to say) and repeats — the first of each key kept, in order.
 */
export function uniqueReadings(
  wanted: Iterable<SpeechRequest | null | undefined>,
): SpeechRequest[] {
  const out = new Map<string, SpeechRequest>();
  for (const r of wanted) if (r && r.parts.length > 0 && !out.has(r.key)) out.set(r.key, r);
  return [...out.values()];
}
