// `@partybox/game-sdk/ui` — React primitives for games and the client shells (docs/DESIGN_SYSTEM.md).
// Kept separate from the pure entry point (ADR-023) because these import CSS modules.

// Types client code needs (also available from the pure entry point).
export type {
  GameControllerProps,
  GameFinaleProps,
  GameLoaders,
  GameMusic,
  GameMusicScene,
  GamePhoneModule,
  GameSettingsModule,
  GameStation,
  StagePickProps,
  GameShared,
  GameTvModule,
  GameTvProps,
  StationPiece,
} from './client-module';
export type {
  ControllerView,
  PlayerStatus,
  PushedView,
  TvView,
  ViewEnvelope,
  ViewPlayer,
} from '@partybox/shared';

export { ArtThemeProvider, artStyles, useArtStyles, useArtSurface } from './ui/art';
export type { ArtSurface } from './ui/art';

// ── shared ───────────────────────────────────────────────────────────────────────────────────
export { Avatar, AvatarPhotos, avatarColorVar } from './ui/Avatar';
export { avatarFaceSvg } from './ui/avatarSvg';
export type { AvatarProps } from './ui/Avatar';
export { PlayerChip, splitBotName } from './ui/PlayerChip';
export { LeadMark } from './ui/LeadMark';
export { ContentLang, contentMark, contentNote, marksContent } from './ui/lang';
export type { ContentLangProps } from './ui/lang';
export { joinNamesIn } from './ui/joinNamesIn';
export { PauseUsableContext, usePauseUsable } from './ui/pauseUsable';
export type { PauseUsableHolds } from './ui/pauseUsable';
export { boardRows, climbOrder } from './tv/Scoreboard';
export type { StandingLike } from './tv/Scoreboard';
export type { PlayerChipProps } from './ui/PlayerChip';
export { ServerClockProvider, useSecondsLeft, useServerNow, useServerOffset } from './ui/clock';
export { DeadlineBar } from './ui/DeadlineBar';
export {
  applyMotionPreference,
  sanitizeSnapshot,
  setMotionOff,
  useMotionOff,
  usePrefersReducedMotion,
} from './ui/motion';
export type { DeadlineBarProps } from './ui/DeadlineBar';
export {
  CHESS_CUES,
  SOUND_CUES,
  SoundProvider,
  isSoundCue,
  useSound,
  useSoundApi,
} from './ui/sound';
export type {
  ChessCue,
  ClipOptions,
  PlayCue,
  PlayCueOptions,
  SoundApi,
  SoundCue,
} from './ui/sound';
export { buzz, hapticsEnabled, setHapticsEnabled } from './ui/haptics';
export { readThemeColor, useThemeColor } from './ui/themeColor';
export { PhonePrefsProvider, usePhonePrefs } from './ui/prefs';
export type { PhonePrefs, PhoneSwitch } from './ui/prefs';
export { DEFAULT_PAD_STYLE, getPadStyle, setPadStyle, usePadStyle } from './ui/pad';
export type { PadPaper, PadPencil, PadStyle } from './ui/pad';
export { useShellTimerLabel, useTimerLabel } from './ui/timerLabel';
export type { TimerLabel } from './ui/timerLabel';
export { trace } from './ui/trace';
export type { TraceEvent } from './ui/trace';
export { READING_FADE_MS, useReading } from './ui/sound';
export type { ReadingOptions } from './ui/sound';
export { useSay } from './ui/say';
export type { SayPhase } from './ui/say';
export type { SayItem } from './views';
export {
  MOTION_BASE,
  MOTION_FAST,
  MOTION_SLOW,
  useBeats,
  useSequence,
  useCountUp,
  useHold,
  usePrefersReducedMotion as useReducedMotion,
} from './ui/motion';
export { TallyCount, TallyFlights, tallyChipKey, useTally } from './ui/Tally';
export type { Tally } from './ui/Tally';
export { lastLanding, staggerAt } from './ui/tallyMath';
export type { TallyFlightSpec } from './ui/tallyMath';
export { beatAt, useServerBeat, useServerBeats, useServerElapsed } from './ui/clock';
export { landscapeQuery, useLandscape, useMediaQuery } from './ui/motion';
export { cubicBezier, easings, settleTime, spring } from './ui/curves';
export type { Easing, EasingName } from './ui/curves';
export {
  readStoredChoice,
  subscribeStoredChoice,
  useStoredChoice,
  writeStoredChoice,
} from './ui/prefs';

// ── TV ───────────────────────────────────────────────────────────────────────────────────────
export { Stage } from './tv/Stage';
export { lazyFinale } from './tv/lazyFinale';
export type { LazyFinale } from './tv/lazyFinale';
export type { StageProps } from './tv/Stage';
export { BigText } from './tv/BigText';
export type { BigTextProps } from './tv/BigText';
export { Timer } from './tv/Timer';
export type { TimerProps } from './tv/Timer';
export { PlayerChips } from './tv/PlayerChips';
export type { PlayerChipsProps } from './tv/PlayerChips';
export { Scoreboard, boardLandedMs } from './tv/Scoreboard';
export { boardSettledMs } from './tv/boardSettled';
export type { ScoreboardProps, ScoreboardRow } from './tv/Scoreboard';
export { Reveal } from './tv/Reveal';
export type { RevealItem, RevealProps } from './tv/Reveal';
export { Burst, NumberPop, useJuice } from './ui/Juice';
export type { BurstProps, JuiceOptions, NumberPopProps } from './ui/Juice';
export { JUICE_KINDS } from './ui/juice-math';
export type { JuiceKind } from './ui/juice-math';
export { Confetti } from './tv/Confetti';
export type { ConfettiProps } from './tv/Confetti';

// ── controller ───────────────────────────────────────────────────────────────────────────────
export { Screen } from './controller/Screen';
export type { ScreenProps } from './controller/Screen';
export { PrimaryButton } from './controller/PrimaryButton';
export { VipNext } from './controller/VipNext';
export type { VipNextProps } from './controller/VipNext';
export type { PrimaryButtonProps } from './controller/PrimaryButton';
export { WaitingScreen } from './controller/WaitingScreen';
export type { WaitingScreenProps } from './controller/WaitingScreen';
export { DraftScopeProvider, useDraft } from './controller/draft';
export type { DraftStore } from './controller/draft';
export { PhoneOnlyProvider, useCanSeeTv, usePhoneOnly } from './controller/phoneOnly';

// T-0602 / ADR-090: gamepad play (a PS5 pad on the phone); docs/sdk/gamepad.md.
export {
  BUTTON_INDEX,
  PAD,
  PAD_BUTTONS,
  PadGlyph,
  PadProvider,
  PadTracker,
  glyph,
  padFocus,
  padKind,
  usePad,
  usePadPress,
} from './gamepad';
export type {
  PadButton,
  PadGlyphProps,
  PadHandler,
  PadInfo,
  PadKind,
  PadPress,
  PadSample,
} from './gamepad';

export {
  LANGS,
  fill,
  getLang,
  setLang,
  subscribeLang,
  translate,
  translateSent,
  useLang,
  useT,
} from './ui/lang';
export type { Lang, Strings, Translator } from './ui/lang';
export { TextAnswer } from './controller/TextAnswer';
export type { TextAnswerProps } from './controller/TextAnswer';
export { ChoiceGrid } from './controller/ChoiceGrid';
export type { Choice, ChoiceGridProps } from './controller/ChoiceGrid';
export { VoteList } from './controller/VoteList';
export type { VoteListProps, VoteOption } from './controller/VoteList';

// Board games reuse the existing card primitive through the standard game UI entry point.
export { SecretCard } from './pack/secret-card/SecretCard';
export type { SecretCardProps } from './pack/secret-card/SecretCard';

// Audit #5: the same player lookup the server uses (a view's players list).
export { playerName } from './names';
export type { Roster } from './names';
