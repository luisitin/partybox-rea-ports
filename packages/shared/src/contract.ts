// The game contract (docs/GAME_CONTRACT.md). Games implement `GameDefinition`; the engine drives it.
// Changing anything here changes every game — write an ADR first (docs/DECISIONS.md).
import { z } from 'zod';
import { type MinigameContext, minigameSpecSchema } from './minigame-schema';
import { playerCountsSchema, validPlayerCounts } from './player-count-schema';
import { CONTENT_LANGS } from './constants';
import type { BotSkill, ContentLang, GamePresence } from './constants';
import type { Rng, RngState } from './rng';
import { GAME_CATEGORIES } from './game-category';
import type { GameOutcome } from './game-outcome';

// ─── Manifest + settings ────────────────────────────────────────────────────────────────────────

export const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
/** A sibling setting's `key` and `value`, with a `note` for the player (`disabledBy`, `impliedBy`). */
const settingRef = z.object({
  key: z.string(),
  value: z.union([z.boolean(), z.string(), z.number()]),
  note: z.string().max(80),
});
const settingBase = {
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
  label: z.string().min(1).max(40),
  description: z.string().max(200).optional(),
  /** ADR-073: the selected edition cannot use this field; retain its stored preference. */
  disabledBy: settingRef.extend({ note: z.string().min(1).max(80) }).optional(),
  /** I-112 A: while the sibling setting `key` equals `value`, this one is implied — greyed out
   *  with `note` (e.g. "the board already shows it"). */
  impliedBy: settingRef.optional(),
};

export const settingSpecSchema = z.discriminatedUnion('type', [
  z.object({
    ...settingBase,
    type: z.literal('number'),
    default: z.number(),
    min: z.number(),
    max: z.number(),
    step: z.number().positive().optional(),
    /**
     * The ceiling follows the roster: effective max = min(max, players + maxFromPlayers), and a
     * stored value above it displays and starts as that ceiling ("players per book" = −1: everyone
     * else). The game's own start logic keeps the same cap (games/broken-pencil/server/index.ts).
     */
    maxFromPlayers: z.number().int().optional(),
  }),
  z.object({ ...settingBase, type: z.literal('boolean'), default: z.boolean() }),
  z.object({
    ...settingBase,
    type: z.literal('select'),
    default: z.string(),
    /** `lang` (ADR-054): offered only when the room's content language is that one (a reader's
     *  voice); an option without it is offered in every language. */
    options: z
      .array(
        z.object({ value: z.string(), label: z.string(), lang: z.enum(CONTENT_LANGS).optional() }),
      )
      .min(2),
  }),
  /**
   * Several picks from a list (ADR-034): the value is the picked option values joined by commas
   * (`''` = nothing picked, which a game reads as "no filter"). With `groupBy`, the options carry a
   * `group` and only those whose group equals the sibling `select` setting's current value are
   * offered — and kept: the engine drops picks from another group.
   */
  z.object({
    ...settingBase,
    type: z.literal('multiselect'),
    default: z.string(),
    options: z
      .array(z.object({ value: z.string(), label: z.string(), group: z.string().optional() }))
      .min(1),
    groupBy: z.string().optional(),
  }),
]);

export type SettingSpec = z.infer<typeof settingSpecSchema>;

export const DEFAULT_MAX_INPUT_BYTES = 16 * 1024;
export const HARD_MAX_INPUT_BYTES = 256 * 1024;

/**
 * The picker's filter chips (game pack Part 00 §1.2, the owner's ruling 4): 1–3 per game. `quick`
 * is not on the list — the catalog derives it from `estimatedMinutes ≤ QUICK_MINUTES`.
 */
export const GAME_TAGS = [
  'words',
  'drawing',
  'trivia',
  'bluff',
  'hidden-roles',
  'teams',
  'co-op',
  'comedy',
  'strategy',
  'classic',
] as const;
export type GameTag = (typeof GAME_TAGS)[number];
export const QUICK_MINUTES = 8;
/** Where the players must be (Part 00 §3.5): the picker's badge and the notice on choosing. */
export const PRESENCE_NEEDS = ['anywhere', 'voice-if-remote', 'same-room'] as const;
export type PresenceNeeds = (typeof PRESENCE_NEEDS)[number];
/** A file in the game's `art/<style>/` folder (ADR-056), named after what it is: `icon.webp`,
 *  `tile.svg`… A WebP icon is a set (ADR-058): `icon.webp` at 512 and its ICON_RENDITIONS beside it. */
const artFile = <K extends string>(kind: K) =>
  z.enum([`${kind}.png`, `${kind}.svg`, `${kind}.webp`] as const);
/** One style's art (ADR-056/057). */
const artSet = z
  .object({
    /** 512×512, transparent: the picker, the chosen game, the start stage (phones and TV). */
    icon: artFile('icon').optional(),
    /** 1920×1080 key art behind the TV's start stage; its left 45 % stays calm for the text. */
    tile: artFile('tile').optional(),
    /** 1920×1080, low contrast, behind the game's TV stage while it plays. */
    backdrop: artFile('backdrop').optional(),
  })
  .strict();

/** One user-perceived character: `icon` is a single emoji (flags and ZWJ sequences included). */
function oneGrapheme(s: string): boolean {
  return [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].length === 1;
}

export const gameManifestSchema = z
  .object({
    id: z.string().regex(GAME_ID_PATTERN),
    name: z.string().min(1).max(40),
    /** One emoji: the picker's icon tile and the TV card. */
    icon: z.string().min(1).max(16).refine(oneGrapheme, { message: 'icon must be one emoji' }),
    tagline: z.string().min(1).max(60),
    /** Served only through `about` (never in the catalog). */
    description: z.string().min(1).max(300),
    /** The About sheet's 1-2-3 (and the TV mirror's), each step one short sentence. */
    howToPlay: z.tuple([
      z.string().min(1).max(90),
      z.string().min(1).max(90),
      z.string().min(1).max(90),
    ]),
    version: z.string().regex(SEMVER),
    minPlayers: z.number().int().min(1).max(16),
    maxPlayers: z.number().int().min(1).max(16),
    /** ADR-072: a select setting narrows the global roster bounds for an edition or variant. */
    playerCounts: playerCountsSchema.optional(),
    estimatedMinutes: z.number().int().min(1).max(60),
    /** Long board games persist until their rules or the VIP end them, including an empty room. */
    unlimitedDuration: z.boolean().optional(),
    /**
     * I-189: the game's measured pace, so the picker can say how long THIS game will take:
     * fixedSeconds + rounds × (perRoundSeconds + players × perPlayerPerRoundSeconds), where
     * `rounds` is the named setting's value (or the player count, for "players"). Without it the
     * picker shows estimatedMinutes.
     */
    estimate: z
      .object({
        fixedSeconds: z.number().min(0).max(600),
        perRoundSeconds: z.number().min(0).max(600),
        perPlayerPerRoundSeconds: z.number().min(0).max(120),
        roundsSetting: z.string().min(1).max(40),
      })
      .optional(),
    tags: z.array(z.enum(GAME_TAGS)).min(1).max(3),
    /** ADR-099: the picker's top-level category. Required: every game is in exactly one. */
    category: z.enum(GAME_CATEGORIES),
    presence: z.object({
      needs: z.enum(PRESENCE_NEEDS),
      /** One sentence for the lobby notice when this game is chosen in a room that conflicts. */
      note: z.string().min(1).max(140).optional(),
    }),
    /** ISO date the game joined PartyBox: the catalog's NEW badge for 30 days. */
    addedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** The game ships a `PhoneSettings` panel for the lobby's 🎨 sheet (loaded on expand). */
    phoneSettings: z.boolean().optional(),
    settings: z.array(settingSpecSchema).max(14),
    /** ADR-002: raise for stroke-list inputs (drawing games). */
    maxInputBytes: z.number().int().min(1024).max(HARD_MAX_INPUT_BYTES).optional(),
    /**
     * "Available for bots": the author certifies `bot.sampleInput` is a reasonable opponent in every
     * input phase. Players may add bots in the lobby; a game without this flag cannot be started
     * while bots are in the room (ADR-028).
     */
    supportsBots: z.boolean().optional(),
    /**
     * T-0296: the VIP may save a running game to the host PC and resume it later. Only a game whose
     * whole state is JSON and needs no clock but `event.now` (the contract) can honestly say yes.
     */
    saveable: z.boolean().optional(),
    /** ADR-087: the game can run as a 20-120 s minigame inside a board game; absent = it cannot. */
    minigame: minigameSpecSchema.optional(),
    /** ADR-054: the content languages the game ships (its deck, bot lines, reader); absent = ['en'].
     *  A room in a language the game lacks plays it in the first one listed (herd-mind 07b839). */
    contentLangs: z.array(z.enum(CONTENT_LANGS)).min(1).max(CONTENT_LANGS.length).optional(),
    /** T-0535: the game has no cards, prompts or words in a language (a board or dice game), so the picker
     *  shows no "Cards in English" chip for it. Absent = the game has content. */
    noCards: z.literal(true).optional(),
    /**
     * ADR-056/057: the game's drawn art per style, files in `games/<id>/art/<style>/` named after
     * their kind (PNG or SVG), served by the host at `/art/<id>/<style>/<file>` and never bundled.
     * Each one is optional: a style without a piece shows the other style's, and with neither the
     * shell shows the emoji `icon` (and no tile or backdrop). `pnpm check-art` checks them.
     */
    art: z.object({ pop: artSet.optional(), gouache: artSet.optional() }).strict().optional(),
  })
  .refine((m) => m.minPlayers <= m.maxPlayers, { message: 'minPlayers must be <= maxPlayers' })
  .refine(validPlayerCounts, {
    message: 'playerCounts must name select options and ranges within the manifest bounds',
  });
export type GameManifest = z.infer<typeof gameManifestSchema>;

export type SettingValue = number | boolean | string;
export type Settings = Record<string, SettingValue>;
export const settingsSchema = z.record(z.string(), z.union([z.number(), z.boolean(), z.string()]));

// ─── State ──────────────────────────────────────────────────────────────────────────────────────

export interface PlayerInfo {
  id: string;
  name: string;
  /** The face id — or `photo:<id>` for a player with a photo avatar (I-031); pass it to `Avatar`. */
  avatarId: string;
  connected: boolean;
  /** A bot (ADR-028): a game may act for it where a person would tap (Bingo's ready-up). */
  bot?: boolean;
  /**
   * ADR-047: whether this player could see the TV when the game started (bots always can). Absent
   * from hosts before presence. Switch features with it; never branch view content on it.
   */
  canSeeTv?: boolean;
}

export interface PhaseInfo {
  id: string;
  startedAt: number;
  /** ms timestamp; the engine fires exactly one `timer` event per (id, startedAt) once reached. */
  deadline: number | null;
  paused?: { at: number };
  /**
   * Set only by a VIP skip while paused that moved this instance on to a beat (ADR-101): the skip's time.
   * The views read it as the instance start (`phaseAt`) in place of `startedAt`; every other phase
   * leaves it unset.
   */
  beatAt?: number;
}

export interface GameStateBase {
  phase: PhaseInfo;
  rng: RngState;
  players: Record<string, PlayerInfo>;
}

export interface InitContext {
  players: PlayerInfo[];
  settings: Settings;
  seed: number;
  now: number;
  /** ADR-047: where everyone is, fixed at start. Optional: absent means all in one room with a TV. */
  presence?: GamePresence;
  /** ADR-104: how well the room's bots play (ADR-059), fixed at start like `contentLang` (the VIP
   *  cannot change it mid-game). Absent means `normal`. For a game whose views or state show what the
   *  bots play at; `sampleInput` still gets the live `skill`. */
  botSkill?: Exclude<BotSkill, 'normal'>;
  /** ADR-054: the language of this game's shared content (deck, bot lines, reader, matcher),
   *  fixed at start. Optional: absent means 'en'. A game with no pack in it keeps its own. */
  contentLang?: ContentLang;
  /** T-0475: what each player chose in the start stage (player id → option), when the game asked
   *  for a pick (`stagePick`). Absent for a game without one, and for a start that skipped the
   *  stage (sim, saves): `init` then falls back to the game's own pick phase. */
  picks?: Record<string, string>;
  /** ADR-087: set when the game runs as a minigame (`manifest.minigame`): `settings` are then the
   *  defaults plus `manifest.minigame.settings`, and a team mode names the sides here. Absent for a
   *  normal game. */
  minigame?: MinigameContext;
}

// ─── Events ─────────────────────────────────────────────────────────────────────────────────────

export type VipGameAction = 'skip' | 'pause' | 'resume' | 'end';

export type GameEvent<I> =
  /** `vip`: true when the sender is the room's VIP (ADR-042) — a game may reserve an input for
   *  them (Broken Pencil's "close enough" veto) without ever learning who the VIP is otherwise. */
  | { type: 'input'; now: number; playerId: string; input: I; vip?: boolean }
  | { type: 'timer'; now: number; phaseId: string; startedAt: number }
  | {
      type: 'player';
      now: number;
      playerId: string;
      connected: boolean;
      /** I-773 B: set when the player is gone for good — they left, or the VIP removed them. */
      gone?: 'left' | 'kicked';
    }
  | { type: 'vip'; now: number; action: VipGameAction }
  /** READER-VOICES (ADR-045): a reading the game asked for (`speech()`) is ready — `ms` is its
   *  length, or -1 when it could not be made (the game carries on without a voice). */
  | { type: 'speech'; now: number; key: string; ms: number }
  /** T-0159: the host's reader has started making a reading the game asked for; its `speech`
   *  event follows. A game may hold a moment while its own reading is on the way (Blanks); the
   *  rest ignore it. */
  | { type: 'speechStart'; now: number; key: string };

/** A piece of a reading: text for the voice to say, or phonemes (espeak notation) said as given —
 *  with the words beside them, required: a voice that cannot take phonemes (Zira) says `text`
 *  instead, so an ipa part is never silent (game-pack audit #17). */
export type SpeechPart = { text: string } | { ipa: string; text: string };

/** What a speech key may be: lowercase letters, digits and hyphens — room for `<gameId>-<hash>`
 *  (`speechKey` in `@partybox/game-sdk/speech`) and never a path (game-pack audit #18). */
export const SPEECH_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{5,63}$/;

/** A reading a game wants made (ADR-045): the host synthesises it once per `key`, serves it at
 *  /api/speech/<key>.wav and answers with a `speech` event. */
export interface SpeechRequest {
  /** SPEECH_KEY_PATTERN; a content hash, so the WAV behind a key never changes. */
  key: string;
  /** A voice id the host's speech service knows: 'george', 'fable', 'jessica', 'sky', 'original' (English),
   *  'dora', 'alex', 'santa' (Latin American Spanish, ADR-054), and the host voices 'host-hype',
   *  'host-dry', 'host-spooky', 'host-cozy' (ADR-066: made ahead, Kokoro stands in live). */
  voice: string;
  parts: readonly SpeechPart[];
}

// ─── Views ──────────────────────────────────────────────────────────────────────────────────────

export type PlayerStatus = 'active' | 'submitted' | 'waiting' | 'spectator';

export interface ViewPlayer {
  id: string;
  name: string;
  avatarId: string;
  connected: boolean;
  status: PlayerStatus;
  score?: number;
}

/** Common part of every view; the shells render it. Games add their own fields next to it. */
export interface ViewEnvelope {
  gameId: string;
  phaseId: string;
  deadline: number | null;
  paused: boolean;
  /** Server time at which play was held; lets a late/reloaded screen land on the same beat. */
  clockHeldAt?: number;
  /**
   * Start of the phase instance: `phase.beatAt` after a VIP skip while paused moved it to a beat, else
   * `phase.startedAt`. With `phaseId` it names the instance: a VIP resume keeps it; a new phase, a skip
   * or a beat skipped into while paused changes it (ADR-097, ADR-101).
   */
  phaseAt: number;
  players: ViewPlayer[];
  /**
   * How the shells present `deadline` (ADR-030). `normal` (default): digits, red + ticks in the last
   * 5 s. `quiet`: the progress bar only — for phases whose timer is a rhythm, not a countdown
   * (a bingo call, a page of a slideshow). `hidden`: nothing at all.
   */
  timerMode?: 'normal' | 'quiet' | 'hidden';
  /**
   * I-134 A: what a spectator should be shown while they wait. The shell knows a spectator is
   * waiting but nothing about the game they are waiting on; a game that has something worth
   * watching (a number being called) fills this and the wait stops being a blank screen.
   * `line` is the live line: for Bingo, the call and its nickname.
   */
  spectator?: { line: string };
  /**
   * I-774 B: what the VIP's Skip / Next does in this phase, in words ("Next card (2 of 4)"). The
   * TV's host bar and the ★ menu show it instead of the generic "Skip / Next".
   */
  vipSkipLabel?: string;
  /**
   * T-0147: a new screen inside one phase id, for the phone's screen-reader announcer — which says
   * a screen when `phaseId` or this changes. Set it where the same phase repeats with new content
   * a player should hear about (one reveal per card: the card's index); leave it out where a phase
   * restarts on a rhythm (a bingo call), or the reader repeats itself every beat.
   */
  screen?: string;
  /**
   * I-589 (the owner's note): the game shows its own Next button in this phase (on the stage and
   * the VIP's phone), so the TV's host bar and the ★ menu leave out their generic "Skip / Next".
   */
  vipSkipHidden?: boolean;
  /**
   * I-791 D: where the game is, as a count ("question 3 of 10"). A phone coming back after a drop
   * names it ("You missed questions 1 and 2. This is question 3 of 10"); a game without numbered
   * steps omits it and the phone says only whether the game moved on.
   */
  progressStep?: { unit: 'question' | 'round'; n: number; of: number };
}

export type TvView = ViewEnvelope;

export interface ControllerView extends ViewEnvelope {
  me: { id: string; role: 'player' | 'spectator' };
  /**
   * This phone is the stage (the engine stamps it): the room is "phone only" (S-005), or this
   * player can't see the TV (ADR-047). Per phone, live: a mid-game flip moves only this phone.
   */
  phoneOnly?: boolean;
}

/** What actually goes over the wire: the engine adds the VIP (ADR-020). */
export type PushedView<V extends ViewEnvelope> = V & {
  vip: string | null;
  /** ADR-054: the running game's content language, fixed at its start (absent = 'en'). A deck
   *  rendered on the client picks its pack from this, not from the room snapshot's contentLang
   *  (that one is the next game's and can change mid-game). */
  contentLang?: ContentLang;
};

// ─── Results ────────────────────────────────────────────────────────────────────────────────────

export type GameAward = { id: string; title: string; description: string; playerId: string };

export interface GameResults {
  /**
   * I-155 C: optional per-player, per-round detail a CONTROLLER may show as a personal receipt
   * ("your votes: 2 · 0 · 3"). The TV ignores it; a game that keeps no such history omits it.
   */
  perRoundVotes?: Record<string, number[]>;
  scores: Record<string, number>;
  ranking: { playerId: string; score: number; rank: number }[];
  /** Computer seats the game fills: ranked and able to win, never in `state.players`; named as bots. */
  seats?: PlayerInfo[];
  /** Who won. Empty only for a co-op game the players lost (`outcome`). */
  winnerIds: string[];
  awards: GameAward[];
  /** ADR-052: a game that isn't "these players won" says how it ended (co-op, or a team). */
  outcome?: GameOutcome;
  /** ADR-052: the results screen's line, in English (translated through the game's strings, like
   *  awards): "📡 Crystal clear!", "Mission failed". Absent: the shell words it from the outcome. */
  headline?: string;
  /** T-0208: a smaller line under the results headline, in English (translated like `headline`):
   *  why the winner won when the rules had to decide ("Tie-break: the quickest to spot the
   *  imposter"). The headline stays the shell's "Ana wins!", so the reason never wraps it. */
  headlineNote?: string;
  /** T-0196: a game's own line for a player's results phone, in place of the shell's place line
   *  (English, translated like `headline`): the one level with the winner who lost the game's
   *  tie-break, a player the game's rule kept off the crown with the most points. */
  placeLines?: Record<string, string>;
  /** T-0257: short labels under a player's name on the results board, TV and phone (English,
   *  each translated like `headline`): a hidden role revealed, a power used ("Hitler", "Executed"). */
  tags?: Record<string, string[]>;
  /** Unit of `scores` when not points: `ms` shows as seconds ("30.0 s"). Ranks and ties compare raw numbers. */
  scoreUnit?: 'ms';
  /** T-0496: what the TV's outro film shows beyond the scoreboard (the clue solution, the nightfall roles,
   *  the secret-hitler boards), plain JSON, a few hundred bytes, public at the end of the game. The film
   *  hooks (client/intro/film/films.ts) read the keys each game documents in docs/GAME_CONTRACT.md. */
  detail?: Record<string, unknown>;
}

/** One extra file a recap writes next to `recap.md` (a drawing as SVG, a CSV). */
export interface RecapFile {
  /** A plain file name, no folders. */
  name: string;
  body: string;
}

/** A human-readable account of one finished game, written by the host when the room records (ADR-035). */
export interface GameRecap {
  markdown: string;
  files?: RecapFile[];
}

export interface RecapContext<S> {
  players: PlayerInfo[];
  /** The state as each phase instance began, oldest first — the reveal states hold what a game clears per round. */
  history: { phase: string; at: number; state: S }[];
  /** Null when the game was ended early. */
  results: GameResults | null;
}

// ─── The definition ─────────────────────────────────────────────────────────────────────────────

export interface GameBot<S, I> {
  /**
   * A valid input for this player right now, or null when there is nothing to do. `skill`
   * (ADR-059) is how well the room's bots play; absent means `normal`, and a game whose bot has no
   * notion of it may ignore it. Same state, rng and skill ⇒ same input.
   */
  sampleInput(state: S, playerId: string, rng: Rng, skill?: BotSkill): I | null;
  /**
   * Optional (ADR-068): a smarter answer from a language model, when the host runs one
   * (`PARTYBOX_LLM_BOTS`). Both halves stay pure: the host does the asking. Absent, a null ask,
   * a null answer, a slow model or no model at all ⇒ `sampleInput` plays instead.
   */
  llm?: GameBotLlm<S, I>;
}

/** ADR-068: a bot's question for a language model. */
export interface BotAsk {
  /** The whole instruction; the model has no other context. */
  prompt: string;
  /** A line drawing the model should look at (the host renders it to PNG). */
  image?: BotImage;
  /** 'json': the model answers with one JSON value. */
  format?: 'json';
  /** Longest reply wanted, in tokens (default 200). */
  maxTokens?: number;
}

/** Strokes on a `width` × `height` sheet; `color` is a #rrggbb hex, `points` a flat [x, y, …]. */
export interface BotImage {
  width: number;
  height: number;
  background: string;
  strokes: { color: string; width: number; points: number[] }[];
}

export interface GameBotLlm<S, I> {
  /** What this bot would ask right now, or null (sampleInput plays). Only what its phone shows. */
  ask(state: S, playerId: string): BotAsk | null;
  /** The model's reply as an input, or null when it makes no sense (sampleInput plays). */
  answer(state: S, playerId: string, reply: string): I | null;
}

/**
 * S = your state, I = your input union. TV / CV default to the bare envelopes; declare your own view
 * interfaces (extending TvView / ControllerView) so `game.tvView(state).yourField` type-checks in tests.
 */
export interface GameDefinition<
  S extends GameStateBase,
  I,
  TV extends TvView = TvView,
  CV extends ControllerView = ControllerView,
> {
  manifest: GameManifest;
  phases: readonly string[];
  inputSchema: z.ZodType<I>;
  init(ctx: InitContext): S;
  reduce(state: S, event: GameEvent<I>): S;
  tvView(state: S): TV;
  controllerView(state: S, playerId: string): CV;
  results(state: S): GameResults | null;
  bot: GameBot<S, I>;
  /**
   * Optional: what the host writes to disk for the owner's feedback (ADR-035) — a markdown recap and
   * any files it references. Pure like every other method; `null` means "just the state".
   */
  recap?(state: S, ctx: RecapContext<S>): GameRecap | null;
  /**
   * Optional (T-0475): a choice every player makes in the start stage, before the opening and the
   * rules (Monopoly's piece). `options` lists what can be chosen for these settings; each is taken
   * by one player (first tap wins). The engine fills what is left (bots, late and dropped
   * players, the VIP's Start now) with the first free option and hands the result to `init` as
   * `picks`. Pure.
   */
  stagePick?: { options(settings: Settings): readonly string[] };
  /**
   * Optional (ADR-045): the spoken readings this state wants — a game with a voice asks for each
   * one as soon as its text is known, so it is ready before its moment. Pure; the host makes each
   * key once and reports back with a `speech` event.
   */
  speech?(state: S): readonly SpeechRequest[];
  /**
   * Optional (T-0144): every reading the game's content can ask for in one voice and content
   * language — the questions, prompts and fixed lines, not what a room makes up (names, typed
   * answers, a card filled with someone's answer). Pure; the host's warm-up (`pnpm speech:warm`)
   * renders them ahead into the speech cache, so each key must be the one `speech()` asks for.
   */
  speechCatalog?(opts: SpeechCatalogOptions): readonly SpeechRequest[];
}

/** What a speech catalog is asked for (T-0144). */
export interface SpeechCatalogOptions {
  /** A reader voice id (SpeechRequest.voice); 'none' reads nothing. */
  voice: string;
  contentLang: ContentLang;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the registry holds heterogeneous games */
export type AnyGameDefinition = GameDefinition<any, any, any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export const STATE_SIZE_LIMIT_BYTES = 256 * 1024;
