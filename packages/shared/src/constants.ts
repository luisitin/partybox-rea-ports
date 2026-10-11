// The values and helpers a browser needs from this package, with no zod in reach (game pack F1, the
// owner's ruling 11): the client imports them through the barrel, and with `"sideEffects": false`
// the bundler leaves the zod schemas — and zod itself — out of every phone's download.

export const LIMITS = {
  roomCapacity: 16,
  maxPayloadBytes: 16 * 1024,
  inputsPerSecond: 20,
  disconnectGraceMs: 120_000,
  vipHandoverMs: 30_000,
  /** ADR-065: how long a running game does not hear that a phone dropped (a reload, a Wi-Fi blip). */
  dropGraceMs: 8_000,
  pingIntervalMs: 10_000,
  pingTimeoutMs: 20_000,
} as const;

/** A photo avatar (I-031, the owner): a 128 × 128 JPEG the phone made, as a data URL, capped at
 *  24 KB. `avatarId` stays required — the face is the fallback wherever the photo is absent. */
export const PHOTO_MAX_BYTES = 24 * 1024;

export const MAX_BOTS_PER_OWNER = 4;
/** The VIP fills a thin room: up to six bots of their own (owner, 2026-09-30). */
export const MAX_BOTS_VIP = 6;

/** How many bots this player may add. */
export function botLimit(isVip: boolean): number {
  return isVip ? MAX_BOTS_VIP : MAX_BOTS_PER_OWNER;
}

/** BL-018 (ADR-061): a player's PIN is four digits. A seat that takes `PIN_TRIES` wrong ones in a
 *  row rests for `PIN_REST_MS` (no PIN is tried against it meanwhile). */
export const PIN_PATTERN = /^\d{4}$/;
export const PIN_TRIES = 5;
export const PIN_REST_MS = 60_000;
export function isPin(value: unknown): value is string {
  return typeof value === 'string' && PIN_PATTERN.test(value);
}

/** A multiselect value → its picks (deduped, in option order when `spec` is given). */
export function multiselectPicks(
  value: unknown,
  spec?: { options: { value: string }[] },
): string[] {
  const raw = typeof value === 'string' ? value.split(',') : [];
  const picks = [...new Set(raw.map((v) => v.trim()).filter((v) => v.length > 0))];
  if (!spec) return picks;
  const known = spec.options.map((o) => o.value);
  return known.filter((v) => picks.includes(v));
}

/**
 * Where everyone is (Part 00 §3.2, ADR-047), the VIP's room switch: all in one room, some remote on
 * a call, some remote with PartyBox the only shared channel. Here, not in contract.ts: the phones
 * read it, and contract.ts would bring zod into their download.
 */
export const PRESENCE_MODES = ['together', 'remote-voice', 'remote-text'] as const;
export type PresenceMode = (typeof PRESENCE_MODES)[number];

/** D-017 (ADR-057): every piece of art comes in two styles, A 'Punchcut Pop' and B 'Moonlit
 *  Gouache', each in its own folder: `games/<id>/art/pop/`, `games/<id>/art/gouache/`. Here, not in
 *  contract.ts, like PRESENCE_MODES: the phones read them. */
export const ART_STYLES = ['pop', 'gouache'] as const;
export type ArtStyle = (typeof ART_STYLES)[number];
/** D-017/D-020 (ADR-057): which style shows. `mix` (the default) draws icons and everything on a
 *  phone in Pop and the TV's key art and backdrops in Gouache; `pop` and `gouache` use one style
 *  everywhere. The VIP sets it for the room; a phone may pick its own. */
export const ART_THEMES = ['mix', 'pop', 'gouache'] as const;
export type ArtTheme = (typeof ART_THEMES)[number];
/** T-0517: the room's sound set. `default` is the soft voice (chess: the chess.com set); `classic` is
 *  the original synth; `wood` is chess's soft wood set (any other game plays it as `default`). */
export const SOUND_SETS = ['default', 'classic', 'wood'] as const;
export type SoundSet = (typeof SOUND_SETS)[number];
/** ADR-058: a WebP icon's smaller copies, `icon@<size>.webp` beside the 512 `icon.webp`. Phones
 *  load 96 at most (40 on a 1× screen), the TV 256. */
export const ICON_RENDITIONS = [256, 96, 40] as const;
/** The file of one rendition of a WebP icon (`icon.webp` itself at 512). */
export function iconRendition(size: 512 | (typeof ICON_RENDITIONS)[number]): string {
  return size === 512 ? 'icon.webp' : `icon@${size}.webp`;
}

/** ADR-059: how well the room's bots play — the VIP's picker in the lobby. A game's bot
 *  reads it as `sampleInput`'s fourth argument; one that ignores it plays `normal`. Here, not in
 *  contract.ts, like PRESENCE_MODES: the phones read it. */
export const BOT_SKILLS = ['easy', 'normal', 'sharp'] as const;
export type BotSkill = (typeof BOT_SKILLS)[number];

/** ADR-054: the languages a room's shared content (decks, bot lines, the reader) can be in. Each
 *  device's own UI language is separate and stays on the device. */
export const CONTENT_LANGS = ['en', 'es'] as const;
export type ContentLang = (typeof CONTENT_LANGS)[number];
/** What a game learns of the room at `init` (ADR-047): fixed for the game, like the seed. */
export interface GamePresence {
  mode: PresenceMode;
  /** No TV in the room at all (ADR-041). */
  phoneOnly: boolean;
}

/** The art a manifest may name (ADR-056). */
export const ART_KINDS = ['icon', 'tile', 'backdrop'] as const;
export type ArtKind = (typeof ART_KINDS)[number];
