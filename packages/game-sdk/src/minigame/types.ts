// ADR-087: the minigame wrapper's state, input and views. Everything here is plain JSON: a board
// game (Party World) keeps a `MinigameState` inside its own state while the minigame runs.
import type {
  BotSkill,
  ContentLang,
  GamePresence,
  MinigameMode,
  PhaseInfo,
  PlayerInfo,
  RngState,
} from '@partybox/shared';

export type MinigameStage = 'card' | 'howto' | 'countdown' | 'play' | 'finish' | 'result' | 'done';

/** The coins a win pays; the result screen shows the chip and the Double ribbon. */
export interface MinigamePrize {
  coins: number;
  double: boolean;
}

/** One finished minigame: every id passed to `minigameStart` is ranked (cpu seats too). */
export interface MinigameResult {
  gameId: string;
  mode: MinigameMode;
  /** `score`: the game's own number for the player (points, taps…), shown beside the name on the results screen. */
  ranking: { playerId: string; rank: number; score?: number }[];
  /** Rank 1, or the winning team's members; empty when a co-op minigame was lost. */
  winnerIds: string[];
  /** Team modes: the winning side's index into `MinigameState.teams`; null = a draw (or not a team mode). */
  winningTeam: number | null;
}

export interface MinigameState {
  gameId: string;
  mode: MinigameMode;
  /** Member ids per side, as the board handed them over (`[]` in ffa). */
  teams: string[][];
  players: PlayerInfo[];
  seed: number;
  skill: BotSkill;
  contentLang?: ContentLang;
  presence?: GamePresence;
  /** Minigame Help: the instruction screen (with the live demo) is shown. */
  help: boolean;
  /** Showdown: the board encounter's initiator, whose head-start the game gives (T-0603). */
  lead?: string;
  prize: MinigamePrize | null;
  stage: MinigameStage;
  /** When the stage ends by itself (the howto cap, the card, the count, the play's hard cap…). */
  stageEnds: number | null;
  /** Put this in the host game's own `phase` (see `minigamePhase`): the engine wakes it on `deadline`. */
  phase: PhaseInfo;
  ready: string[];
  /** The game's state during play (opaque here), and the live demo's state on the instruction screen. */
  inner: unknown;
  demo: unknown;
  playStartedAt: number | null;
  /** A human has tapped the practice pad: the demo stops playing for the human seats. */
  demoTouched: boolean;
  /** The next beat of the cpu seats, or null. */
  botAt: number | null;
  botRng: RngState;
  /** Set when the play ends; stays through finish/result/done. */
  result: MinigameResult | null;
  /** The play could not run (the game threw or never started): the minigame ends as a draw. */
  broken: boolean;
}

/** What a phone sends while a minigame runs: Ready, or the game's own input untouched. */
export type MinigameInput = { mg: 'ready' } | { mg: 'input'; input: unknown };

export interface MinigameTeamView {
  /** 'a' or 'b', the index into `teams`. */
  id: 'a' | 'b';
  name: string;
  /** ▲ / ●, so a side never rests on colour alone. */
  mark: string;
  color: string;
  members: string[];
}

export interface MinigamePlayerView {
  id: string;
  name: string;
  avatarId: string;
  connected: boolean;
  bot: boolean;
  ready: boolean;
  team: 'a' | 'b' | null;
}

/** What the TV and every phone get; the phone's adds `me`. */
export interface MinigameView {
  gameId: string;
  name: string;
  icon: string;
  mode: MinigameMode;
  stage: MinigameStage;
  teams: MinigameTeamView[];
  players: MinigamePlayerView[];
  help: boolean;
  /** The instruction screen has a live demo (`manifest.minigame.practice`). */
  hasDemo: boolean;
  howTo: [string, string];
  controls: string[];
  /** When the stage ends (howto: the 20 s cap; countdown: the Go; play: the nominal end). */
  stageEnds: number | null;
  prize: MinigamePrize | null;
  /** The game's own view during play, the demo's during the howto, else null. */
  inner: unknown;
  demo: unknown;
  result: MinigameResult | null;
}

export interface MinigameControllerView extends MinigameView {
  me: { id: string; ready: boolean; team: 'a' | 'b' | null };
}

export interface MinigameStartArgs {
  players: PlayerInfo[];
  mode: MinigameMode;
  /** Member ids per side; ignored in `ffa`; derived for `duel` when absent. */
  teams?: string[][];
  seed: number;
  now: number;
  help: boolean;
  /** Showdown: who started the encounter (a player id); the game starts them ahead. */
  lead?: string;
  prize?: MinigamePrize;
  skill?: BotSkill;
  contentLang?: ContentLang;
  presence?: GamePresence;
}
