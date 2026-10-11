// Socket.IO protocol (docs/PROTOCOL.md): every client → server payload has a zod schema here; the
// server → client shapes are plain types (the server builds them, clients trust them).
import { z } from 'zod';
import type { GameResults, PlayerInfo, PresenceNeeds, SettingSpec, Settings } from './contract';
import type { GameCategory } from './game-category';
import {
  ART_THEMES,
  BOT_SKILLS,
  SOUND_SETS,
  CONTENT_LANGS,
  PHOTO_MAX_BYTES,
  PIN_PATTERN,
} from './constants';
import type {
  ArtKind,
  ArtStyle,
  ArtTheme,
  BotSkill,
  ContentLang,
  PresenceMode,
  SoundSet,
} from './constants';
import { PRESENCE_MODES } from './constants';
import { settingsSchema } from './contract';
import type { MinigameMode, PickerKind } from './minigame-schema';

// ─── client → server ────────────────────────────────────────────────────────────────────────────

/** A photo avatar (I-031): a data URL of at most PHOTO_MAX_BYTES (constants.ts). */
export const photoSchema = z
  .string()
  .max(PHOTO_MAX_BYTES)
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/);

export const joinPayloadSchema = z.object({
  roomCode: z.string().max(8).optional(),
  name: z.string().max(64),
  avatarId: z.string().max(32),
  token: z.string().max(128).optional(),
  photo: photoSchema.optional(),
  /** I-741 C: "That's me — take my seat". */
  takeOver: z.boolean().optional(),
  /** ADR-047: the phone's own "I can see the TV" (🎨), when it has one; else the host guesses. */
  canSeeTv: z.boolean().optional(),
  /** ADR-054: this phone's language; the VIP's is the room's content language until one is chosen. */
  lang: z.enum(CONTENT_LANGS).optional(),
  /** ADR-061: the player's PIN, when the room asks for one (a new seat's, or a seat taken back). */
  pin: z.string().regex(PIN_PATTERN).optional(),
});
export type JoinPayload = z.infer<typeof joinPayloadSchema>;

export const inputPayloadSchema = z.object({
  seq: z.number().int().nonnegative(),
  input: z.unknown(),
});
export type InputPayload = z.infer<typeof inputPayloadSchema>;

/** ADR-047: a phone flips its "I can see the TV" (any time; a running game keeps its start value). */
export const presencePayloadSchema = z.object({ canSeeTv: z.boolean() });
/** ADR-054: the phone's language changed (🎨); the VIP's is the room's content language by default. */
export const langPayloadSchema = z.object({ lang: z.enum(CONTENT_LANGS) });
export type LangPayload = z.infer<typeof langPayloadSchema>;
export type PresencePayload = z.infer<typeof presencePayloadSchema>;
/** ADR-061: a seated player sets (or changes) their PIN while the room asks for PINs. */
export const pinPayloadSchema = z.object({ pin: z.string().regex(PIN_PATTERN) });
export type PinPayload = z.infer<typeof pinPayloadSchema>;

/** T-0475: a player's choice in the start stage (`stagePick`): the option id. */
export const stagePickPayloadSchema = z.object({ value: z.string().min(1).max(40) });
export type StagePickPayload = z.infer<typeof stagePickPayloadSchema>;

export const vipPayloadSchema = z.discriminatedUnion('action', [
  /** `null`: the game list with nothing chosen (Part 00 §1.3; nothing downloads until a pick). */
  z.object({ action: z.literal('selectGame'), gameId: z.string().max(32).nullable() }),
  /** Part 00 §1.4: the VIP opened a game's About (its id) or closed it (null): the TV mirrors it. */
  z.object({ action: z.literal('highlight'), gameId: z.string().max(32).nullable() }),
  z.object({ action: z.literal('updateSettings'), settings: settingsSchema }),
  /** ADR-053: opens the start stage (rules, everyone's READY, 3·2·1). */
  z.object({ action: z.literal('start') }),
  /** ADR-053: in the stage, the count begins now; outside one, the game starts at once. */
  z.object({ action: z.literal('startNow') }),
  /** ADR-053: from the stage back to the picker. */
  z.object({ action: z.literal('back') }),
  z.object({ action: z.literal('skip') }),
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume') }),
  z.object({ action: z.literal('end') }),
  z.object({ action: z.literal('kick'), playerId: z.string().max(64) }),
  z.object({ action: z.literal('transferVip'), playerId: z.string().max(64) }),
  /** I-347 C: the VIP whose role passed on while away takes it back. */
  z.object({ action: z.literal('reclaimVip') }),
  z.object({ action: z.literal('lock') }),
  z.object({ action: z.literal('unlock') }),
  z.object({ action: z.literal('playAgain') }),
  z.object({ action: z.literal('toLobby') }),
  /** I-088 A: the room's own size (4–16), never below the people already in. */
  z.object({ action: z.literal('setCapacity'), capacity: z.number().int().min(4).max(16) }),
  /** Whether the host keeps a recap of the next game on disk (ADR-035); any time but mid-game. */
  z.object({ action: z.literal('setRecording'), on: z.boolean() }),
  /** S-004 (the owner): every phone plays the room's music when this is on. */
  z.object({ action: z.literal('setMusicOnPhones'), on: z.boolean() }),
  /** T-0376: the room's music also stays on the TV while the phones play it (default off). */
  z.object({ action: z.literal('setMusicOnBoth'), on: z.boolean() }),
  // ADR-054: the room's content language (the TV's language switch sends it too)
  z.object({ action: z.literal('setContentLang'), lang: z.enum(CONTENT_LANGS) }),
  /** D-020 (ADR-057): the room's art theme (TV and phones; a phone may keep its own), any time. */
  z.object({ action: z.literal('setArtTheme'), theme: z.enum(ART_THEMES) }),
  z.object({ action: z.literal('setSoundSet'), set: z.enum(SOUND_SETS) }),
  /** ADR-059: how well the room's bots play; any time but mid-game. */
  z.object({ action: z.literal('setBotSkill'), skill: z.enum(BOT_SKILLS) }),
  /** S-005: the room's "phone only" mode; any time but mid-game. */
  z.object({ action: z.literal('setPhoneOnly'), on: z.boolean() }),
  /** ADR-047: "Where is everyone?" — beside Phone only, any time but mid-game. */
  z.object({ action: z.literal('setPresenceMode'), mode: z.enum(PRESENCE_MODES) }),
  /** The owner (2026-09-22): whether this room shows up in the join page's room list. */
  z.object({ action: z.literal('setListed'), on: z.boolean() }),
  /** ADR-061: a PIN to take a seat back by name (off clears every PIN); any time. */
  z.object({ action: z.literal('setPins'), on: z.boolean() }),
]);
export type VipAction = z.infer<typeof vipPayloadSchema>;

export const tvJoinPayloadSchema = z.object({ roomCode: z.string().max(8).optional() });
export type TvJoinPayload = z.infer<typeof tvJoinPayloadSchema>;

/** Any player may add bots they own (ADR-028); owners and the VIP may remove them. */
export const botPayloadSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add') }),
  z.object({ action: z.literal('remove'), botId: z.string().max(64) }),
]);
export type BotAction = z.infer<typeof botPayloadSchema>;

/** I-650: a person's vote for the next game (null takes it back). */
export const votePayloadSchema = z.object({ gameId: z.string().max(32).nullable() });

/** How a bot decides when to act; `random` is what the lobby button creates. */
export const BOT_STRATEGIES = ['random', 'fast', 'slow', 'idle', 'chaos'] as const;
export type BotStrategy = (typeof BOT_STRATEGIES)[number];

// ─── server → client ────────────────────────────────────────────────────────────────────────────

export type RoomStatus = 'lobby' | 'selecting' | 'playing' | 'results';

export interface PlayerPublic {
  id: string;
  name: string;
  /** The face — or, for a player with a photo, `photo:<id>`: every surface that renders an
   *  avatar id resolves it through the room's photos (I-031), so views stay small. */
  avatarId: string;
  /** The photo avatar (a JPEG data URL), only in the room snapshot. */
  photo?: string;
  isVip: boolean;
  connected: boolean;
  spectator: boolean;
  joinedAt: number;
  /** Present for bots: who added it (null = added by the dev API). */
  bot?: { ownerId: string | null; strategy: BotStrategy };
  /** ADR-047: false when this person can't see the TV (absent = can; bots always can). */
  canSeeTv?: false;
}

/** I-189: a game's measured pace — minutes = (fixedSeconds + rounds × (perRoundSeconds + players ×
 *  perPlayerPerRoundSeconds)) / 60, `rounds` read from the named setting (its default when the room
 *  has not set it), or the player count for "players". A tuple: it rides in every catalog entry. */
export type GamePace = readonly [
  fixedSeconds: number,
  perRoundSeconds: number,
  perPlayerPerRoundSeconds: number,
  roundsSetting: string,
  roundsDefault?: number,
];

/**
 * One game in the lobby's catalog (game pack Part 00 §1.2): what the picker lists, built once by the
 * host and sent once per connection (`catalog`). No long text — the description, the how-to-play
 * steps and the settings' words come through `about` when someone opens it. ≤ 440 B per entry (ADR-091).
 */
export type CatalogSeats = readonly [
  setting: string,
  defaultValue: string,
  defaultRange: readonly [number, number],
  overrides: Readonly<Record<string, readonly [number, number]>>,
];

export interface CatalogEntry {
  id: string;
  name: string;
  /** One emoji. */
  icon: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  /** ADR-072: setting, its default, default range, and edition overrides. */
  seats?: CatalogSeats;
  estimatedMinutes: number;
  pace?: GamePace;
  /** The manifest's 1–3 tags, plus `quick` when the game runs 8 minutes or less. */
  tags: string[];
  /** ADR-099: the picker's top-level category (the manifest's `category`). */
  category: GameCategory;
  presence: PresenceNeeds;
  supportsBots: boolean;
  /** T-0296: the VIP can save this game and resume it later. */
  saveable?: true;
  /** Joined PartyBox in the last 30 days (by the host's clock when the catalog was built). */
  isNew?: true;
  /** The game has a panel in the lobby's 🎨 sheet. */
  phoneSettings?: true;
  /** The tagline in the other languages the game ships (the picker's only per-row sentence). */
  i18n?: Partial<Record<string, { tagline: string }>>;
  /** ADR-054: the content languages the game ships, when more than English. */
  contentLangs?: ContentLang[];
  /** T-0535: no cards, prompts or words in a language: the picker hides the "Cards in …" chip. */
  noCards?: true;
  /** ADR-091: the game runs as a minigame (`manifest.minigame`): listed under the picker's
   *  Jamboree tab. `m` = its modes, `boss` = a boss fight, `only` = Jamboree-only (off the main list). */
  minigame?: { m: MinigameMode[]; boss?: true; only?: true };
}

export interface Catalog {
  /** Changes whenever the host's game list does (a restart with a new game). */
  rev: string;
  games: CatalogEntry[];
  /** ADR-056/057: each game's drawn icon per style as `<ext>.<version>` by game id (the file is
   *  `/art/<id>/<style>/icon.<ext>?v=<version>`); a game not here shows its emoji. Beside the
   *  entries, not in them: the ≤ 400 B entry budget is the list row's words. */
  art?: Record<string, Partial<Record<ArtStyle, string>>>;
  /** D-091: each Jamboree-tab game's subgroup by id, beside the entries for the same budget reason
   *  as `art`. A game not here is not on that tab. */
  kinds?: Record<string, PickerKind>;
}

/** `GET /api/games/:id/about?lang=` — the About sheet's words, already in `lang` (≤ 2 KB). */
export interface GameAbout {
  id: string;
  lang: string;
  tagline: string;
  description: string;
  howToPlay: [string, string, string];
  /** One plain-language line per setting ("Rounds — Rounds to play; …"). */
  settings: { key: string; label: string; line?: string }[];
  presenceNote?: string;
  /** ADR-056/057: the TV's stage art per style as versioned URLs (the key art behind the start
   *  stage, the backdrop behind play); absent = none. Only the TV loads them. */
  art?: Partial<Record<ArtStyle, Partial<Record<Exclude<ArtKind, 'icon'>, string>>>>;
}

/** The chosen game's settings form, in the room snapshot while a game is chosen. */
export interface SelectedGame {
  id: string;
  settings: SettingSpec[];
}

export interface RoomResults {
  gameId: string;
  results: GameResults;
  /** Names/avatars of everyone who played, including players who left. */
  players: PlayerInfo[];
  /** Server time the game ended (T-0515): names this results screen, so its outro has a barrier of its own. */
  at?: number;
}

export interface RoomSnapshot {
  code: string;
  status: RoomStatus;
  locked: boolean;
  capacity: number;
  players: PlayerPublic[];
  vip: string | null;
  selectedGameId: string | null;
  settings: Settings;
  /** I-763 B: what the VIP tuned per game tonight (absent until something was tuned). */
  tuned?: Record<string, Settings>;
  /** The chosen game's settings form (absent while nothing is chosen). The game list itself is
   *  the catalog, sent once per connection. */
  selectedGame?: SelectedGame;
  results: RoomResults | null;
  /** Why the VIP's Start button is disabled, if it is. */
  canStart: { ok: true } | { ok: false; reason: string };
  /** The host writes a recap of each game to disk while this is on (ADR-035). */
  recording: boolean;
  /** S-004: every phone plays the room's music plan (the VIP's switch, default off). */
  musicOnPhones: boolean;
  /** T-0376: the TV keeps playing the music while the phones do; absent = false. */
  musicOnBoth?: boolean;
  /** D-020 (ADR-057): the room's art theme, set by the VIP (or the TV); absent = `mix`. */
  artTheme?: Exclude<ArtTheme, 'mix'>;
  /** T-0517: the room's sound set, set by the VIP; absent = `default`. */
  soundSet?: Exclude<SoundSet, 'default'>;
  /** ADR-059: how well the room's bots play, set by the VIP; absent = `normal`. */
  botSkill?: Exclude<BotSkill, 'normal'>;
  /** ADR-054: the language of the next game's shared content: the VIP's or TV's choice, else the
   *  VIP phone's language, else 'en'. Every device's UI (the TV's too) keeps its own language. A
   *  running game's deck reads the view's contentLang, which is fixed at its start. */
  contentLang: ContentLang;
  /** S-005: "phone only" — games hand the phones what the TV would show; set by the VIP. */
  phoneOnly: boolean;
  /** ADR-047: where everyone is (the VIP's switch); absent = `together`, the default. */
  presenceMode?: Exclude<PresenceMode, 'together'>;
  /** I-746 B: every phone is asleep and the game is paused until one is back. */
  asleep?: boolean;
  /** I-652 B: tonight's finished games (newest last) and their human winners. */
  tonight?: { gameId: string; winners: { name: string; avatarId: string }[]; botsWon: boolean }[];
  /** I-347 C: the player who may take the VIP back (their role passed on while they were away). */
  formerVip?: string;
  /** I-650: who wants to play what next (player id → game id) — people still here, never bots. */
  votes?: Record<string, string>;
  /** Part 00 §1.4: the game the VIP is reading about on the open list; the TV shows it big. */
  highlightedGameId?: string;
  /** ADR-053: the start stage, between Start and the game. */
  starting?: StartingSnapshot;
  /** The owner (2026-09-22): a listed ("public") room appears in the join page's room list; a
   *  private one can still be joined by anyone who knows its code. */
  listed: boolean;
  /** ADR-061: the room asks for a PIN — a new seat sets one, a seat taken back by name needs it. */
  pins?: true;
}

/** ADR-053: who has read the rules, and when the 3·2·1 began (server clock; null while reading).
 *  The TV's and phones' count derive every number from `countdownAt`, so they land together. */
export interface StartingSnapshot {
  gameId: string;
  /** Server time the stage began (T-0515): names this start, so its opening has a barrier of its own. */
  startedAt?: number;
  ready: string[];
  countdownAt: number | null;
  /** The VIP said Wait during the count; only their Start now counts again. */
  held?: boolean;
  /** T-0475: the game's pick before the rules: what can be chosen and who chose what. Present only
   *  while someone still has to choose; the opening and the rules wait for it. */
  pick?: { options: string[]; picks: Record<string, string>; done: boolean };
}

export interface WelcomePayload {
  playerId: string;
  token: string;
  room: RoomSnapshot;
  at: number;
}

export interface RoomPush {
  rev: number;
  room: RoomSnapshot;
  /** Server time when pushed; clients derive their clock offset from it. */
  at: number;
}

export interface ViewPush<V> {
  rev: number;
  view: V;
  at: number;
}

export type ToastKind = 'info' | 'success' | 'warning';
export interface ToastPayload {
  kind: ToastKind;
  text: string;
  /** I-040 B: the player this is about — the lobby rings their chip while the toast shows. */
  playerId?: string;
}

export type ErrorCode =
  | 'invalid_payload'
  | 'name_invalid'
  | 'name_taken'
  | 'avatar_invalid'
  | 'room_full'
  | 'room_locked'
  | 'room_not_found'
  | 'bad_token'
  | 'not_vip'
  | 'not_in_room'
  | 'unknown_game'
  | 'cannot_start'
  | 'invalid_input'
  | 'not_playing'
  | 'rate_limited'
  | 'payload_too_large'
  | 'bots_not_supported'
  | 'bot_limit'
  // ADR-061: a new seat in a PIN room needs one; a seat with a PIN, its PIN; five misses rest it
  | 'pin_required'
  | 'pin_needed'
  | 'pin_wrong'
  | 'pin_locked';

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  /** I-040 C: `name_taken` names who has it, with their face. */
  player?: { name: string; avatarId: string };
}

export interface KickedPayload {
  /** Why this phone lost its seat: the VIP's message, or `another_tab` (this login plays in another
   *  tab, I-755) or `another_phone` (another phone took the seat by name, T-0165). */
  reason: string;
}

// ─── saved games (T-0296) ───────────────────────────────────────────────────────────────────────

/** The VIP's phone asks for the list, saves the running game, resumes a save or deletes it. */
export const savesPayloadSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }),
  z.object({ action: z.literal('save'), label: z.string().max(40).optional() }),
  z.object({ action: z.literal('resume'), id: z.string().regex(/^[a-z0-9]{8,32}$/) }),
  z.object({ action: z.literal('delete'), id: z.string().regex(/^[a-z0-9]{8,32}$/) }),
]);
export type SavesPayload = z.infer<typeof savesPayloadSchema>;

/** One save as the lobby lists it. */
export interface SaveSummary {
  id: string;
  label: string;
  savedAt: number;
  gameId: string;
  gameName: string;
  players: { name: string; avatarId: string }[];
  /** False when this host runs another version of the game: the row says why, Resume is off. */
  resumable: boolean;
  problem?: string;
}

/** The answer to every `saves` message: the list as it is now, and what happened to the request. */
export interface SavesResult {
  saves: SaveSummary[];
  /** A short sentence for the toast: what was done, or why the request was refused. */
  message?: string;
  ok: boolean;
}
