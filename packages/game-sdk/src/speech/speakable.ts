// toSpeakable (Part 00 §5.2–5.5, platform request P4): what the reader voice receives for a line.
// The display text never changes; this rewrites only what the voice gets, as parts — text, or
// phonemes with their words beside them for Zira (every ipa part carries `text`, audit #17).
// Order: rule 1, then the overrides (the game's list, then the SDK's), then rules 2–13. What an
// override or rule 8 produces is frozen: later rules never touch it. Pure and deterministic.
import type { SpeechPart } from '@partybox/shared';
import globalList from './overrides.en.json' with { type: 'json' };
import { possessivePhonemes, spellParts, spelled } from './letters';
import { numberWords, readNumbers } from './numbers';
import { applyPatterns, applyWords, parsePronunciations } from './overrides';
import type { Freeze, Override, Pronunciations } from './overrides';
import {
  SAY_AS_WORD,
  abbreviations,
  blanks,
  calmShouting,
  dropEmoji,
  pacing,
  possessivesToPlurals,
  straighten,
  symbolsToWords,
  tidy,
  undotAcronyms,
  unstretch,
} from './rules';

/** The SDK's list (§5.4): words the voices get wrong everywhere. A game's list beats it. */
const GLOBAL: Pronunciations = parsePronunciations(globalList);
/** Rule 13: a player's line is read to at most this many characters, cut at a word. */
export const PLAYER_TEXT_MAX = 140;
const MARK0 = 0xe000;

export interface SpeakableOptions {
  /** The reader's voice id: British voices (george, fable) get British letter names ("zed"). */
  voice: string;
  /** The line's language. The voices are English: Spanish gets only rules 1, 9, 10 and 11. */
  lang: 'en' | 'es';
  /** The game's own list (`parsePronunciations(content/pronunciations.json)`); it beats the SDK's. */
  overrides?: Pronunciations;
  /** The content item the line comes from, for that item's own fixes (`items[id]`). */
  itemId?: string;
  /** Written by a player: also rules 7 (shouting), 12 (stretched words) and 13 (140 characters). */
  playerText?: boolean;
}

function render(entry: Override, word: string, voice: string): SpeechPart[] {
  if (entry.ipa) return [{ ipa: entry.ipa, text: entry.say ?? word }];
  if (entry.spell) return spellParts(word, voice, (d) => numberWords(d, true));
  return [{ text: entry.say ?? word }];
}

/** Rule 3 after a frozen part (audit #47): "Harambe's" keeps the phonemes and adds the ending
 *  ("z"/"ɪz"/"s") to them, and "'s" to the words Zira reads. */
function possessiveAfterFrozen(text: string, frozen: SpeechPart[][]): string {
  return text.replace(
    /([\u{E000}-\u{F8FF}])'(s?)(?![\p{L}\p{N}])/gu,
    (_, mark: string, s: string) => {
      const parts = frozen[mark.charCodeAt(0) - MARK0]!;
      const last = parts[parts.length - 1];
      if (s && last) {
        parts[parts.length - 1] =
          'ipa' in last
            ? { ipa: `${last.ipa}${possessivePhonemes(last.ipa)}`, text: `${last.text}'s` }
            : { text: `${last.text}'s` };
      }
      return mark;
    },
  );
}

/** Splits the (tidied) placeholder string back into parts; neighbouring text joins into one part,
 *  so a frozen respelling and the words around it reach the voice as one phrase. */
function assemble(text: string, frozen: readonly SpeechPart[][]): SpeechPart[] {
  const pieces: SpeechPart[] = [];
  for (const chunk of tidy(text).split(/([\u{E000}-\u{F8FF}])/u)) {
    const mark = /^[\u{E000}-\u{F8FF}]$/u.test(chunk)
      ? frozen[chunk.charCodeAt(0) - MARK0]
      : undefined;
    for (const part of mark ?? [{ text: chunk }]) {
      const prev = pieces[pieces.length - 1];
      if (!('ipa' in part) && prev && !('ipa' in prev)) prev.text += part.text;
      else pieces.push({ ...part });
    }
  }
  return pieces
    .map((p) => ({ ...p, text: p.text.replace(/\s+/g, ' ').trim() }))
    .filter((p) => p.text.length > 0);
}

/** Rule 13: at most `max` characters, cut at a word boundary (a single longer word is cut). */
function capLength(parts: readonly SpeechPart[], max: number): SpeechPart[] {
  const out: SpeechPart[] = [];
  let used = 0;
  for (const part of parts) {
    const gap = out.length > 0 ? 1 : 0;
    if (used + gap + part.text.length <= max) {
      out.push(part);
      used += gap + part.text.length;
      continue;
    }
    if (!('ipa' in part)) {
      const head = part.text.slice(0, max - used - gap + 1);
      const at = head.lastIndexOf(' ');
      const kept = at > 0 ? head.slice(0, at) : out.length === 0 ? part.text.slice(0, max) : '';
      if (kept) out.push({ text: kept });
    }
    break;
  }
  return out;
}

/**
 * The parts a reader voice should get for `text` (§5.3). Never throws; `[]` when nothing is left
 * to say (emoji only, for example).
 */
export function toSpeakable(text: string, opts: SpeakableOptions): SpeechPart[] {
  let t = straighten(text);
  if (opts.lang === 'es') {
    t = tidy(dropEmoji(pacing(blanks(t))));
    return t ? [{ text: t }] : [];
  }
  const frozen: SpeechPart[][] = [];
  const freeze: Freeze = (parts) => {
    frozen.push(typeof parts === 'string' ? [{ text: parts }] : [...parts]);
    return String.fromCharCode(MARK0 + frozen.length - 1);
  };
  const say = (entry: Override, word: string): SpeechPart[] => render(entry, word, opts.voice);

  const item = opts.itemId !== undefined ? opts.overrides?.items.get(opts.itemId) : undefined;
  if (item?.whole) return assemble(freeze(say(item.whole, t)), frozen);
  if (item) t = applyWords(t, item.list, say, freeze);
  if (opts.overrides) t = applyWords(t, opts.overrides.words, say, freeze);
  t = applyWords(t, GLOBAL.words, say, freeze);
  if (opts.overrides) t = applyPatterns(t, opts.overrides.patterns, freeze);
  t = applyPatterns(t, GLOBAL.patterns, freeze);

  t = possessivesToPlurals(possessiveAfterFrozen(t, frozen)); // rules 2 and 3
  t = abbreviations(symbolsToWords(readNumbers(t))); // rules 4, 5, 6
  if (opts.playerText) t = calmShouting(t); // rule 7
  t = undotAcronyms(t).replace(
    // Rule 8: 2–5 capitals are spelled, a plural's "s" riding on the last letter ("C E O's") —
    // not the say-as-word list, nor a stretched shout ("NOOO", rule 12's).
    /(?<![\p{L}\p{N}'])(\p{Lu}{2,5})(s?)(?![\p{L}\p{N}'])/gu,
    (m, run: string, s: string) =>
      SAY_AS_WORD.has(run) || /(\p{L})\1\1/u.test(run)
        ? m
        : freeze([spelled(run, opts.voice, !!s)]),
  );
  t = dropEmoji(pacing(blanks(t))); // rules 9, 10, 11
  if (opts.playerText) t = unstretch(t); // rule 12
  const parts = assemble(t, frozen);
  return opts.playerText ? capLength(parts, PLAYER_TEXT_MAX) : parts;
}

/**
 * A player's name as the reader should say it (§5.5), or null when it should skip it: nothing left
 * after cleaning, no vowel, or no more letters than digits and symbols ("x1234", "K-9"). Pass the
 * result through toSpeakable like any other text.
 */
export function speakableName(name: string): string | null {
  const clean = tidy(dropEmoji(straighten(name).replace(/_+/g, ' ')));
  const letters = clean.match(/\p{L}/gu)?.length ?? 0;
  const others = clean.replace(/[\p{L}\p{M}\s]/gu, '').length;
  const vowel = /[aeiouy]/i.test(clean.normalize('NFD').replace(/\p{M}/gu, ''));
  return clean && vowel && letters >= others ? clean : null;
}
