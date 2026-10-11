// Public surface of @partybox/game-sdk: everything a game is allowed to import (ADR-009).
// Sections: contract (from shared) · reducer helpers · UI primitives (docs/DESIGN_SYSTEM.md).

// ── contract types + zod, re-exported from shared ─────────────────────────────────────────────
export {
  PARTYBOX_VERSION,
  coerceSetting,
  gameManifestSchema,
  multiselectPicks,
  playerCountRange,
  z,
} from '@partybox/shared';
export type {
  ControllerView,
  GameAward,
  BotAsk,
  BotImage,
  GameBot,
  GameBotLlm,
  GameDefinition,
  GameEvent,
  GameManifest,
  GameOutcome,
  GameRecap,
  GameResults,
  GameStateBase,
  InitContext,
  PhaseInfo,
  PlayerInfo,
  PlayerStatus,
  PushedView,
  RecapContext,
  RecapFile,
  Rng,
  RngState,
  SettingSpec,
  Settings,
  SettingValue,
  SpeechCatalogOptions,
  SpeechPart,
  SpeechRequest,
  TvView,
  ViewEnvelope,
  ViewPlayer,
  VipGameAction,
  GamePresence,
  PresenceMode,
  MinigameContext,
  MinigameMode,
  MinigameSpec,
} from '@partybox/shared';
// ADR-087: run a game as a minigame inside a board game (docs/sdk/minigame.md)
export { MINIGAME_MODES, minigameSpecSchema } from '@partybox/shared';
export {
  CAP_FACTOR,
  CARD_MS,
  COUNT_MS,
  FINISH_MS,
  HOWTO_CAP_MS,
  RESULT_MS,
  minigameNextWake,
  minigamePhase,
  minigameReduce,
  minigameResult,
  minigameStart,
} from './minigame/run';
export { normalizeResult } from './minigame/result';
export { minigameSettings } from './minigame/safe';
export {
  minigameGames,
  minigameModeFor,
  minigameModesOf,
  minigameSpeech,
  minigameSupports,
  pickMinigame,
} from './minigame/pool';
export { minigameController, minigameTv } from './minigame/views';
export {
  minigameLoader,
  registerMinigameLoader,
  registerMinigames,
  registeredMinigames,
  resetMinigameLoaderForTests,
} from './minigame/registry';
export type { MinigameModuleLoader } from './minigame/registry';
export type {
  MinigameControllerView,
  MinigameInput,
  MinigamePlayerView,
  MinigamePrize,
  MinigameResult,
  MinigameStage,
  MinigameStartArgs,
  MinigameState,
  MinigameTeamView,
  MinigameView,
} from './minigame/types';
// ADR-047: where everyone is, for games that switch features on it
export { PRESENCE_MODES } from '@partybox/shared';
// ADR-059: how well the room's bots play (`bot.sampleInput`'s fourth argument)
export { BOT_SKILLS } from '@partybox/shared';
export type { BotSkill } from '@partybox/shared';
export type {
  GameControllerProps,
  GameLoaders,
  GamePhoneModule,
  GameSettingsModule,
  GameStation,
  StagePickProps,
  GameShared,
  GameTvModule,
  GameTvProps,
  StationPiece,
} from './client-module';

// ── randomness (pure `[value, next]` helpers; `createRng` only for bots) ──────────────────────
export {
  createRng,
  hashString,
  nextFloat,
  nextInt,
  pick,
  seedRng,
  shuffle,
} from '@partybox/shared';

// ── reducer helpers ──────────────────────────────────────────────────────────────────────────
export {
  allConnectedDone,
  applyVip,
  connectedIds,
  enterPhase,
  hasPlayer,
  isPaused,
  isTimerFor,
  nextStep,
  onPlayerEvent,
  pausedFor,
  patienceNet,
  recheckOnResume,
  setConnected,
  shiftClocks,
} from './timer';
export type { ClockKey, PatienceNet, PlayerEvent, PlayerEventOptions, VipHandlers } from './timer';
export { readingMs, wordCount } from './reading';
export type { ReadingOpts } from './reading';
export {
  addScores,
  buildResults,
  completeScores,
  coopResults,
  rank,
  rankPlayers,
  speedPoints,
  standingsWithDelta,
  teamResults,
} from './scoring';
export type { RankedRow, StandingRow, TeamOutcome } from './scoring';
export { boolSetting, numberSetting, picksSetting, readSettings, selectSetting } from './settings';
export type { SettingsSource } from './settings';
export { joinNames, playerName } from './names';
export type { Roster } from './names';
export { isoDay, recapMarkdown, recapName } from './recap';
export type { RecapPlan } from './recap';
export { pickAwards } from './awards';
export type { AwardOptions, AwardRule, TiePolicy } from './awards';
export { controllerEnvelope, envelope, viewPlayers } from './views';
export type { EnvelopeOptions, SayItem } from './views';
export { compareCodeUnits } from './compare';
export { composeReduce } from './reduce';
export type { PhaseReducer, ReduceParts, Transition } from './reduce';
export { drawFromDeck } from './deck';
export type { DeckDraw } from './deck';
export { majorityPick, plurality, rotation, teamsFromSeed } from './turns';
export type { Teams } from './turns';

// ── answer packs (ADR-048); the matcher itself is `@partybox/game-sdk/match` ─────────────────
export {
  answerItemSchema,
  answerLangSchema,
  answerPackSchema,
  checkAnswerPack,
} from './answer-pack';
export type { AnswerItem, AnswerPack, AnswerPackOptions, AnswerPackReport } from './answer-pack';

// UI primitives live in `@partybox/game-sdk/ui` (ADR-023): this entry point stays free of React
// and CSS so game server code can be loaded by Node (server, sim, contract tests).

export { assetUrl } from './assets';
export type { AssetForm, AssetId } from '@partybox/shared';
