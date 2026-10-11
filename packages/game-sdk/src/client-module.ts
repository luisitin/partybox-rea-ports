// What a game's client entries export and the client registry loads (ADR-050). Each game has a
// phone entry (`games/<id>/client/phone-entry.ts` → `phone`) and a TV entry (`tv-entry.ts` → `tv`), each its
// own download: a phone fetches its game's phone entry only once the game is chosen, and never a
// TV entry. The part both need (`shared.ts`) is spread into both. A game with a panel in the
// lobby's 🎨 sheet also has `settings-entry.ts` → `settings`, fetched when a player opens that panel.
import type { ComponentType, LazyExoticComponent } from 'react';
import type { ControllerView, PushedView, RoomSnapshot, TvView } from '@partybox/shared';
import type { Strings } from './ui/lang';

export interface GameTvProps<V extends TvView = TvView> {
  view: PushedView<V>;
  /**
   * I-589 (the owner: "a next question button the vip or tv can click"): ends the current phase
   * the way the host bar's "Skip / Next" does. The TV is the screen the party is run from
   * (ADR-031), so the shell passes it; a game renders a button with it only in a phase whose view
   * sets `vipSkipHidden`, so the room never sees two buttons for one action.
   */
  skip?: () => void;
}

/** Props of a game's optional `Finale` (rendered on the results stage under the winner line). */
export interface GameFinaleProps<V extends TvView = TvView> {
  /** The last view the stage showed while playing — the game's own last board. */
  lastView: PushedView<V>;
  room: RoomSnapshot;
}

export interface GameControllerProps<V extends ControllerView = ControllerView, I = unknown> {
  view: PushedView<V>;
  /** The player this phone belongs to. */
  me: { id: string; name: string; avatarId: string };
  send: (input: I) => void;
  /**
   * Present on the VIP's phone only: ends the current phase the way the VIP menu's "Skip / Next"
   * does (the engine's `vip` skip, so the server enforces who may). A game that offers a
   * "Next" button renders it only when this is set; it never learns who the VIP is (ADR-020,
   * ADR-036).
   */
  skip?: () => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- each game narrows its own view/input types */

/** What both surfaces read: the room's sound plan (a phone plays it in a phone-only room or with
 *  phone music on) and the game's words. `games/<id>/client/shared.ts`. */
export interface GameShared {
  id: string;
  /**
   * Optional map from TV phase id (`view.phaseId`) to a design-system cue name
   * (docs/DESIGN_SYSTEM.md): the TV shell plays it when that phase begins. Unmapped phases play
   * `phase`, which is reserved for "your phone needs you"; unknown cue names fall back to it too.
   */
  sounds?: Record<string, string>;
  /**
   * Background music on the TV while this game plays (the shell's music engine: tracks are ids
   * under /music/, fetched by scripts/fetch-music.ts). `phases` limits it to those phase ids.
   */
  music?: GameMusic;
  /**
   * Synthesized music beds on the TV, by phase id (ADR-032): a bed id per phase the shell should
   * play under that phase; unmapped phases are silent. Bed ids live in the client ();
   * unknown ids are ignored. A bed that returns resumes where it left off. A phase may name
   * several beds: the shell takes the next one each time that phase begins (loop #197).
   */
  beds?: Readonly<Record<string, string | readonly string[]>>;
  /** No points in this game: the results headline says the show is over instead of calling an
   *  all-zero scoreboard a tie (review-loop #63). */
  scoreless?: boolean;
  /**
   * The game's own words in other languages (the owner, 2026-09-22: every screen translatable to
   * Spanish), keyed by the English sentence: its screens read them through `useT(strings)`, and
   * the shell translates what the game's server writes (errors, awards) from the same table. The
   * manifest's sentences live in `manifest.es.json` (ADR-049). Content stays in the deck's language.
   */
  strings?: Strings;
  /**
   * T-0475: the game's pick screen in the start stage (`GameDefinition.stagePick`), shown on the TV and on every
   * phone. It rides in the game's shared module, so it adds no download of its own.
   */
  StagePick?: ComponentType<StagePickProps>;
}

/** `games/<id>/client/phone-entry.ts` exports `phone`. */
export interface GamePhoneModule extends GameShared {
  Controller: ComponentType<GameControllerProps<any, any>>;
  /**
   * S-005: in a "phone only" room the phones show what the TV would for these phases — a lazy
   * component taking the controller view, rendered by the shell in place of the Controller.
   */
  PhoneStage?: LazyExoticComponent<ComponentType<{ view: PushedView<ControllerView> }>>;
  phoneStagePhases?: readonly string[];
}

/** `games/<id>/client/tv-entry.ts` exports `tv`. */
export interface GameTvModule extends GameShared {
  Tv: ComponentType<GameTvProps<any>>;
  /**
   * TV phase ids the shell should cut INTO quickly (loop 296): the outgoing screen's ghost fades
   * over `--pb-motion-fast` instead of `--pb-motion-base` and the incoming screen does not rise,
   * for a phase whose own entrance is the choreography (Bingo's ball dropping out of the cage:
   * under a 300 ms ghost the thud landed on a ball the room could not yet see, and the phones,
   * which cut, showed the number two frames before the TV).
   */
  quickInto?: readonly string[];
  /**
   * T-0210 (ADR-064): the game's input phases. The TV stage lands in from above a beat after the
   * phones' answers fly off, tilted, with one bounce; the header, strip and timer hold still.
   * Wins over `quickInto`; never into the first phase (the curtain opens on it). Off under
   * reduced motion and the motion switch.
   */
  tossInto?: readonly string[];
  /**
   * T-0210 (ADR-064): the game's reveal phases. The new stage opens from the centre in a
   * starburst iris over the old one. Wins over `quickInto`; otherwise as `tossInto`.
   */
  irisInto?: readonly string[];
  /**
   * T-0332: one stage for the whole game. The shell never swaps the game's TV between its phases
   * (no ghost and no pan, toss or iris), so the game animates its own phase changes and what it
   * mounts once lives once: Monopoly's 3D board and its WebGL context. Wins over `quickInto`,
   * `tossInto` and `irisInto`. Default: each phase is a fresh screen.
   */
  keepMounted?: boolean;
  /**
   * Whether the TV strip may show running scores for this view (default: yes whenever players
   * carry a `score`). Return false for a phase whose stage reveals points beat by beat, so the
   * strip never leads the stage (a reveal that applies points on entry but steps its rows).
   * A number is a delay: the strip holds for that many ms after the phase starts on this TV, then
   * shows the new totals (the stage's own beat — Blanks names its winner 1200 ms into the result).
   */
  stripScores?: (view: PushedView<TvView>) => boolean | number;
  /**
   * Player ids the TV strip should ring as "on" for this view (I-017): the seat asked to read a
   * card out, the judge deciding — whoever the room should look at. Default: nobody.
   */
  stripActive?: (view: PushedView<TvView>) => readonly string[];
  /** T-0290: who wears the strip's leader mark when the game breaks score ties itself. Default: everyone on the top score. */
  stripLeaders?: (view: PushedView<TvView>) => readonly string[];
  /** I-131 A: phases whose stage needs the height — the strip drops to faces only. */
  stripCompact?: readonly string[];
  /**
   * I-131 C: phases where the strip's chips fade out. The header keeps its height (T-0179: the
   * gold rule never moves between phases), so the stage gains no room.
   */
  stripHidden?: readonly string[];
  /**
   * T-0179: the game draws its own seat row in every phase (Secret Hitler, Spy Grid). The shell
   * never shows the strip, and the header is only the timer row, so the stage keeps the room.
   */
  stripOff?: boolean;
  /**
   * T-0179: the TV never shows the strip's big countdown (every phase's `timerMode` is quiet or
   * hidden: Bingo, Tune In), so the header reserves only the chip row and the deadline bar.
   */
  quietTimer?: boolean;
  /**
   * TV phase ids where the game plays its own lock-in sound (I-020: Blanks' `card` pluck as a
   * submission lands on the table); the shell's per-push `lock` tick stays quiet there so one
   * lock-in is one note. Default: the shell ticks.
   */
  ownLocks?: readonly string[];
  /**
   * The results stage keeps the game's last board up instead of the generic scoreboard when
   * `finale(lastView)` says so — a Lightning final-wager board stays until Play again / Home.
   */
  finale?: (lastView: PushedView<any>) => boolean;
  /** Made with `lazyFinale`, so the TV fetches it while the game plays (T-0226). */
  Finale?: LazyExoticComponent<ComponentType<GameFinaleProps<any>>> & {
    preload?: () => Promise<unknown>;
    /** The component once downloaded: the shell renders it directly, with no Suspense. */
    loaded?: () => ComponentType<GameFinaleProps<any>> | null;
  };
}

/** `games/<id>/client/settings-entry.ts` exports `settings` (S-003: the game's own per-phone setup). */
export interface GameSettingsModule {
  /** The panel in the lobby's 🎨 sheet, so a player sets up while they wait. */
  PhoneSettings: ComponentType;
  /** S-003 C: one line of the current setup for the lobby ("Focus · Motion on"). */
  phoneSetup?: () => string;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** One model of a game's station in the living room (T-0408): a GLB the game ships, placed by data. */
export interface StationPiece {
  /** The GLB's url: `new URL('./station/x.glb?no-inline', import.meta.url).href` in the game's own folder. */
  model: string;
  /** Metres from the station's `position`; y is the height above whatever it stands on. */
  at: readonly [number, number, number];
  /** Turn about the up axis, radians. */
  ry?: number;
  /** Real height in metres, or `width`: the longer side of its footprint. Give one of the two. */
  height?: number;
  width?: number;
}

/**
 * `games/<id>/client/station-entry.ts` exports `station` (T-0408, owner rule 2026-10-02: room assets are never
 * copies). Where the game sits in the living room the intro shows on /tv and on a joining phone: its own
 * pieces, a light and a camera shot to dive in on. Pure data, so a game never imports three.js; the room
 * shell places it and a model update in the game's folder shows in the intro by itself.
 */
export interface GameStation {
  /** Where the station stands in the room (metres: x right, y up, z towards the couch; the TV is at z -2.5). */
  position: readonly [number, number, number];
  pieces: readonly StationPiece[];
  /** A small warm light over the station; none by default. Metres from `position`. */
  light?: { color: string; intensity: number; at: readonly [number, number, number] };
  /** The camera shot that dives in on it (the game-select cinematics, v2): eye and look-at, in room metres. */
  dive?: { eye: readonly [number, number, number]; look: readonly [number, number, number] };
}

/** What the start stage hands a game's pick screen (T-0475, `GameDefinition.stagePick`). */
export interface StagePickProps {
  /** What can be chosen, in the game's own order (`stagePick.options`). */
  options: readonly string[];
  /** Who holds what so far (player id → option); the TV shows it, a phone shows it and marks its own. */
  picks: Readonly<Record<string, string>>;
  /** Everyone at the table, in seat order. */
  players: readonly { id: string; name: string; avatarId: string; bot: boolean }[];
  /** The room's settings for this game (an edition, say). */
  settings: Readonly<Record<string, string | number | boolean>>;
  /** On a phone: the seated player; absent on the TV. */
  me?: string;
  /** On a phone: take an option. Absent on the TV, which only shows. */
  choose?: (option: string) => void;
}

/** One game's downloads, as the generated registry lists them (ADR-050). */
export interface GameLoaders {
  phone: () => Promise<GamePhoneModule>;
  tv: () => Promise<GameTvModule>;
  settings?: () => Promise<GameSettingsModule>;
  /** T-0408: the game's corner of the living-room intro; absent when the game has none. */
  station?: () => Promise<GameStation>;
  /** T-0475: where the game's own piece files are served (id → url), for the opening film; just the urls, no code. */
  filmPieces?: () => Promise<Readonly<Record<string, string>>>;
}

export interface GameMusic {
  tracks: readonly string[];
  /** Pick weights, same order as `tracks` (chain mode); equal when absent. */
  weights?: readonly number[];
  /** Steady level 0..1 — keep it under the caller / cues. */
  volume: number;
  /** chain: whole tracks back to back; rotate: 30–60 s each with a fade and a breath between. */
  mode: 'rotate' | 'chain';
  phases?: readonly string[];
  /**
   * T-0653: the game scores its own scenes instead of one playlist. Called with the TV's view (null before the first
   * arrives) and the room's status on every update; returns the scene to play, or null for silence. A new `key`
   * crossfades to the scene's `tracks` (chained, looping); the same key leaves the music alone, so the key must name
   * the scene, never the frame. Needs `tracks: []` and ignores `phases`. Never throws, whatever the view holds.
   */
  scenes?: (view: TvView | null, status: string) => GameMusicScene | null;
}

export interface GameMusicScene {
  key: string;
  tracks: readonly string[];
  /** Overrides `GameMusic.volume` for this scene. */
  volume?: number;
  /** How long the scene takes to fade in under the one before it (default 1.6 s). */
  fadeMs?: number;
  /** When another scene cuts this one short, it comes back on the same track at the same second (a board bed under a shop). */
  resume?: boolean;
}
