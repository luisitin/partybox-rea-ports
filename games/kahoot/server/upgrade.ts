// Original injected-base upgrade: no existing game implementation or assets are imported.
import { gameManifestSchema, z } from '@partybox/game-sdk';
import type {
  ControllerView,
  GameDefinition,
  GameEvent,
  GameManifest,
  GameStateBase,
  InitContext,
  Settings,
  TvView,
} from '@partybox/game-sdk';
import { game as quiz } from './index';
import type { Input, State } from './types';
import type { QuizControllerView, QuizTvView } from './views';
import { upgradeHooks } from './upgrade-hooks';

export type QuizUpgradeMode = 'teams' | 'tv-vote';
export type PlayMode = 'classic' | QuizUpgradeMode;
export const QUIZ_SETTING_KEYS = {
  pack: 'quizPack',
  rounds: 'quizRounds',
  seconds: 'quizSeconds',
  teamCount: 'quizTeamCount',
  talkSeconds: 'quizTalkSeconds',
} as const;
export type UpgradeInput<I> =
  | { type: 'mode-input'; playMode: 'classic'; input: I }
  | { type: 'mode-input'; playMode: QuizUpgradeMode; input: Input };
export type UpgradeState<S extends GameStateBase> = GameStateBase &
  ({ playMode: 'classic'; selected: S } | { playMode: QuizUpgradeMode; selected: State });
export type UpgradeTvView<V extends TvView> =
  (V & { playMode: 'classic' }) | (QuizTvView & { playMode: QuizUpgradeMode });
export type UpgradeControllerView<V extends ControllerView> =
  (V & { playMode: 'classic' }) | (QuizControllerView & { playMode: QuizUpgradeMode });
export interface UpgradeModeInfo {
  playMode: PlayMode;
  howToPlay: GameManifest['howToPlay'];
  contentLangs: NonNullable<GameManifest['contentLangs']>;
  estimatedMinutes: number;
  estimate: GameManifest['estimate'];
  scoreless: boolean;
  minPlayers: number;
  maxPlayers: number;
  minigame: GameManifest['minigame'];
}

export function readPlayMode(settings: Settings): PlayMode {
  return settings.playMode === 'teams' || settings.playMode === 'tv-vote'
    ? settings.playMode
    : 'classic';
}

const quizRules: Record<QuizUpgradeMode, GameManifest['howToPlay']> = {
  teams: [
    'Talk with your team before the answer clock opens; then each player locks one choice.',
    'Speed and streak points are averaged across eligible teammates; highest team total wins.',
    'Watch team gains and standings, then the final podium. Ties share a place.',
  ],
  'tv-vote': [
    'Discuss the question together, then each phone casts one vote for an answer.',
    'The most votes decide the answer; seeded ties break fairly. The room scores together.',
    'Speed uses the mean vote time; correct room answers build a streak and show points.',
  ],
};

export function upgradeModeInfo(
  base: GameManifest,
  playMode: PlayMode,
  baseScoreless = false,
): UpgradeModeInfo {
  const selected = playMode === 'classic' ? base : quiz.manifest;
  return {
    playMode,
    howToPlay: playMode === 'classic' ? base.howToPlay : quizRules[playMode],
    contentLangs: selected.contentLangs ?? ['en'],
    estimatedMinutes: selected.estimatedMinutes,
    estimate:
      playMode === 'classic' || !selected.estimate
        ? selected.estimate
        : {
            ...selected.estimate,
            roundsSetting:
              QUIZ_SETTING_KEYS[
                selected.estimate.roundsSetting as keyof typeof QUIZ_SETTING_KEYS
              ] ?? selected.estimate.roundsSetting,
          },
    scoreless: playMode === 'classic' ? baseScoreless : false,
    minPlayers: selected.minPlayers,
    maxPlayers: selected.maxPlayers,
    minigame: playMode === 'classic' ? base.minigame : undefined,
  };
}

/** Wrap a legacy classic save by reference; the SDK sees the exact selected timer/RNG/players. */
export function upgradeClassicState<S extends GameStateBase>(selected: S): UpgradeState<S> {
  return {
    playMode: 'classic',
    selected,
    phase: selected.phase,
    rng: selected.rng,
    players: selected.players,
  };
}
function quizState<S extends GameStateBase>(
  playMode: QuizUpgradeMode,
  selected: State,
): UpgradeState<S> {
  return {
    playMode,
    selected,
    phase: selected.phase,
    rng: selected.rng,
    players: selected.players,
  };
}
const reserved = ['playMode', ...Object.values(QUIZ_SETTING_KEYS)];
function classicSettings(settings: Settings): Settings {
  return reserved.some((key) => Object.hasOwn(settings, key))
    ? Object.fromEntries(Object.entries(settings).filter(([key]) => !reserved.includes(key)))
    : settings;
}
function classicContext(ctx: InitContext): InitContext {
  const settings = classicSettings(ctx.settings);
  return settings === ctx.settings ? ctx : { ...ctx, settings };
}
function quizContext(ctx: InitContext, playMode: QuizUpgradeMode): InitContext {
  const settings: Settings = { mode: playMode };
  for (const [key, external] of Object.entries(QUIZ_SETTING_KEYS))
    if (Object.hasOwn(ctx.settings, external)) settings[key] = ctx.settings[external]!;
  return { ...ctx, settings, contentLang: 'en' };
}

export function createKahootUpgrade<
  S extends GameStateBase,
  I,
  TV extends TvView,
  CV extends ControllerView,
>(
  base: GameDefinition<S, I, TV, CV>,
): GameDefinition<UpgradeState<S>, UpgradeInput<I>, UpgradeTvView<TV>, UpgradeControllerView<CV>> {
  if (base.manifest.playerCounts)
    throw new Error('Upgrade cannot overwrite an existing setting-dependent player range.');
  if (base.manifest.settings.some((setting) => reserved.includes(setting.key)))
    throw new Error('Upgrade setting keys conflict with the injected classic game.');
  const maxInputBytes =
    Math.max(base.manifest.maxInputBytes ?? 16_384, quiz.manifest.maxInputBytes ?? 16_384) + 64;
  if (maxInputBytes > 262_144)
    throw new Error('Mode-wrapped inputs exceed the SDK hard input cap.');
  const quizSettings = quiz.manifest.settings
    .filter((setting) => setting.key !== 'mode')
    .map((setting) => {
      const key = QUIZ_SETTING_KEYS[setting.key as keyof typeof QUIZ_SETTING_KEYS];
      if (!key) throw new Error(`Quiz setting is not namespaced: ${setting.key}`);
      return {
        ...setting,
        key,
        label: `Quiz: ${setting.label}`,
        disabledBy: { key: 'playMode', value: 'classic', note: 'Team/vote quiz only' },
      };
    });
  const manifest = gameManifestSchema.parse({
    ...base.manifest,
    minPlayers: Math.min(base.manifest.minPlayers, quiz.manifest.minPlayers),
    maxPlayers: Math.max(base.manifest.maxPlayers, quiz.manifest.maxPlayers),
    maxInputBytes,
    supportsBots: base.manifest.supportsBots === true && quiz.manifest.supportsBots === true,
    playerCounts: {
      setting: 'playMode',
      default: [base.manifest.minPlayers, base.manifest.maxPlayers],
      overrides: {
        teams: [quiz.manifest.minPlayers, quiz.manifest.maxPlayers],
        'tv-vote': [quiz.manifest.minPlayers, quiz.manifest.maxPlayers],
      },
    },
    settings: [
      ...base.manifest.settings,
      {
        key: 'playMode',
        label: 'Quiz mode',
        type: 'select',
        default: 'classic',
        options: [
          { value: 'classic', label: 'Classic Lightning Round' },
          { value: 'teams', label: 'Kahoot! teams' },
          { value: 'tv-vote', label: 'TV answer vote' },
        ],
      },
      ...quizSettings,
    ],
  });
  const inputSchema: z.ZodType<UpgradeInput<I>> = z.discriminatedUnion('playMode', [
    z
      .object({
        type: z.literal('mode-input'),
        playMode: z.literal('classic'),
        input: base.inputSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal('mode-input'),
        playMode: z.literal('teams'),
        input: quiz.inputSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal('mode-input'),
        playMode: z.literal('tv-vote'),
        input: quiz.inputSchema,
      })
      .strict(),
  ]);
  const reduce = (state: UpgradeState<S>, event: GameEvent<UpgradeInput<I>>): UpgradeState<S> => {
    if (event.type !== 'input') {
      if (state.playMode === 'classic') {
        const next = base.reduce(state.selected, event);
        return next === state.selected ? state : upgradeClassicState(next);
      }
      const next = quiz.reduce(state.selected, event);
      return next === state.selected ? state : quizState(state.playMode, next);
    }
    const parsed = inputSchema.safeParse(event.input);
    if (!parsed.success || parsed.data.playMode !== state.playMode) return state;
    if (state.playMode === 'classic' && parsed.data.playMode === 'classic') {
      const next = base.reduce(state.selected, { ...event, input: parsed.data.input });
      return next === state.selected ? state : upgradeClassicState(next);
    }
    if (state.playMode !== 'classic' && parsed.data.playMode !== 'classic') {
      const next = quiz.reduce(state.selected, { ...event, input: parsed.data.input });
      return next === state.selected ? state : quizState(state.playMode, next);
    }
    return state;
  };
  return {
    manifest,
    phases: [...new Set([...base.phases, ...quiz.phases])],
    inputSchema,
    init: (ctx) => {
      const mode = readPlayMode(ctx.settings);
      return mode === 'classic'
        ? upgradeClassicState(base.init(classicContext(ctx)))
        : quizState(mode, quiz.init(quizContext(ctx, mode)));
    },
    reduce,
    tvView: (state) =>
      state.playMode === 'classic'
        ? { ...base.tvView(state.selected), gameId: base.manifest.id, playMode: 'classic' }
        : { ...quiz.tvView(state.selected), gameId: base.manifest.id, playMode: state.playMode },
    controllerView: (state, id) =>
      state.playMode === 'classic'
        ? {
            ...base.controllerView(state.selected, id),
            gameId: base.manifest.id,
            playMode: 'classic',
          }
        : {
            ...quiz.controllerView(state.selected, id),
            gameId: base.manifest.id,
            playMode: state.playMode,
          },
    results: (state) =>
      state.playMode === 'classic' ? base.results(state.selected) : quiz.results(state.selected),
    ...upgradeHooks(base, quiz, classicSettings),
  };
}
