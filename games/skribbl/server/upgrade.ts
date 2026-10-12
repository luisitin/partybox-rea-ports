// Inject the existing game; this module contains no other game's implementation or assets.
import { gameManifestSchema, z } from '@partybox/game-sdk';
import type {
  ControllerView,
  GameDefinition,
  GameEvent,
  GameManifest,
  GameStateBase,
  InitContext,
  RecapContext,
  Settings,
  SpeechCatalogOptions,
  TvView,
} from '@partybox/game-sdk';
import { game as live } from './index';
import type { DrawControllerView, DrawTvView, Input, State } from './types';

export type PlayMode = 'telephone' | 'live-guessing';
export const UPGRADE_MODE_KEY = 'playMode';
export const LIVE_SETTING_KEYS = {
  laps: 'liveLaps',
  drawSeconds: 'liveDrawSeconds',
  difficulty: 'liveDifficulty',
} as const;

export type UpgradeInput<I> =
  | { type: 'mode-input'; playMode: 'telephone'; input: I }
  | { type: 'mode-input'; playMode: 'live-guessing'; input: Input };
export type UpgradeState<S extends GameStateBase> = GameStateBase &
  ({ playMode: 'telephone'; selected: S } | { playMode: 'live-guessing'; selected: State });
export type UpgradeTvView<V extends TvView> =
  (V & { playMode: 'telephone' }) | (DrawTvView & { playMode: 'live-guessing' });
export type UpgradeControllerView<V extends ControllerView> =
  (V & { playMode: 'telephone' }) | (DrawControllerView & { playMode: 'live-guessing' });
export interface UpgradeModeInfo {
  playMode: PlayMode;
  howToPlay: GameManifest['howToPlay'];
  contentLangs: NonNullable<GameManifest['contentLangs']>;
  estimatedMinutes: number;
  estimate: GameManifest['estimate'];
  scoreless: boolean;
  minPlayers: number;
  maxPlayers: number;
}

/** Unknown or stale lobby values keep the existing telephone game as the default. */
export function readPlayMode(settings: Settings): PlayMode {
  return settings[UPGRADE_MODE_KEY] === 'live-guessing' ? 'live-guessing' : 'telephone';
}

/** Host start/results presentation must resolve these against the selected running mode. */
export function upgradeModeInfo(
  base: GameManifest,
  playMode: PlayMode,
  baseScoreless = false,
): UpgradeModeInfo {
  const selected = playMode === 'telephone' ? base : live.manifest;
  return {
    playMode,
    howToPlay: selected.howToPlay,
    contentLangs: selected.contentLangs ?? ['en'],
    estimatedMinutes: selected.estimatedMinutes,
    estimate: selected.estimate,
    scoreless: playMode === 'telephone' ? baseScoreless : false,
    minPlayers: playMode === 'telephone' ? Math.max(3, base.minPlayers) : selected.minPlayers,
    maxPlayers: selected.maxPlayers,
  };
}

/** Also usable when migrating an existing telephone save; selected state is never cloned. */
export function upgradeTelephoneState<S extends GameStateBase>(selected: S): UpgradeState<S> {
  return { playMode: 'telephone', selected, ...envelopeState(selected) };
}

function envelopeState(selected: GameStateBase): GameStateBase {
  return { phase: selected.phase, rng: selected.rng, players: selected.players };
}

function liveState<S extends GameStateBase>(selected: State): UpgradeState<S> {
  return { playMode: 'live-guessing', selected, ...envelopeState(selected) };
}

const reserved: readonly string[] = [UPGRADE_MODE_KEY, ...Object.values(LIVE_SETTING_KEYS)];
function telephoneSettings(settings: Settings): Settings {
  if (!reserved.some((key) => Object.hasOwn(settings, key))) return settings;
  return Object.fromEntries(Object.entries(settings).filter(([key]) => !reserved.includes(key)));
}

function telephoneContext(ctx: InitContext): InitContext {
  const settings = telephoneSettings(ctx.settings);
  return settings === ctx.settings ? ctx : { ...ctx, settings };
}

function liveContext(ctx: InitContext): InitContext {
  const settings: Settings = {};
  for (const [key, external] of Object.entries(LIVE_SETTING_KEYS)) {
    if (Object.hasOwn(ctx.settings, external)) settings[key] = ctx.settings[external]!;
  }
  return { ...ctx, settings };
}

function telephoneHistory<S extends GameStateBase>(
  ctx: RecapContext<UpgradeState<S>>,
): RecapContext<S> {
  const history: RecapContext<S>['history'] = [];
  for (const entry of ctx.history)
    if (entry.state.playMode === 'telephone')
      history.push({ ...entry, state: entry.state.selected });
  return { ...ctx, history };
}

function liveHistory<S extends GameStateBase>(
  ctx: RecapContext<UpgradeState<S>>,
): RecapContext<State> {
  const history: RecapContext<State>['history'] = [];
  for (const entry of ctx.history)
    if (entry.state.playMode === 'live-guessing')
      history.push({ ...entry, state: entry.state.selected });
  return { ...ctx, history };
}

/** Install under the injected game's canonical registry key, never as a second core game. */
export function createSkribblUpgrade<
  S extends GameStateBase,
  I,
  TV extends TvView,
  CV extends ControllerView,
>(
  base: GameDefinition<S, I, TV, CV>,
): GameDefinition<UpgradeState<S>, UpgradeInput<I>, UpgradeTvView<TV>, UpgradeControllerView<CV>> {
  if (base.manifest.playerCounts)
    throw new Error('Upgrade needs a base without another setting-dependent player range.');
  if (base.manifest.settings.some((setting) => reserved.includes(setting.key)))
    throw new Error('Upgrade setting keys conflict with the supplied base.');
  if (base.manifest.maxPlayers < 3)
    throw new Error('Telephone mode needs a base that supports at least three players.');
  // The fixed mode envelope adds fewer than 64 bytes to any existing serialized input.
  const maxInputBytes =
    Math.max(base.manifest.maxInputBytes ?? 16_384, live.manifest.maxInputBytes ?? 16_384) + 64;
  if (maxInputBytes > 262_144) throw new Error('Wrapped inputs exceed the SDK hard input cap.');
  const manifest = gameManifestSchema.parse({
    ...base.manifest,
    minPlayers: live.manifest.minPlayers,
    maxPlayers: Math.max(base.manifest.maxPlayers, live.manifest.maxPlayers),
    estimatedMinutes: Math.max(base.manifest.estimatedMinutes, live.manifest.estimatedMinutes),
    maxInputBytes,
    supportsBots: base.manifest.supportsBots === true && live.manifest.supportsBots === true,
    playerCounts: {
      setting: UPGRADE_MODE_KEY,
      default: [Math.max(3, base.manifest.minPlayers), base.manifest.maxPlayers],
      overrides: { 'live-guessing': [live.manifest.minPlayers, live.manifest.maxPlayers] },
    },
    settings: [
      ...base.manifest.settings,
      {
        key: UPGRADE_MODE_KEY,
        label: 'Drawing mode',
        type: 'select',
        default: 'telephone',
        options: [
          { value: 'telephone', label: 'Telephone books' },
          { value: 'live-guessing', label: 'Skribbl.io live guessing' },
        ],
      },
      ...live.manifest.settings.map((setting) => ({
        ...setting,
        key: LIVE_SETTING_KEYS[setting.key as keyof typeof LIVE_SETTING_KEYS],
        label: `Live: ${setting.label}`,
        disabledBy: { key: UPGRADE_MODE_KEY, value: 'telephone', note: 'Live guessing only' },
      })),
    ],
  });
  const inputSchema: z.ZodType<UpgradeInput<I>> = z.discriminatedUnion('playMode', [
    z
      .object({
        type: z.literal('mode-input'),
        playMode: z.literal('telephone'),
        input: base.inputSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal('mode-input'),
        playMode: z.literal('live-guessing'),
        input: live.inputSchema,
      })
      .strict(),
  ]);

  const reduce = (state: UpgradeState<S>, event: GameEvent<UpgradeInput<I>>): UpgradeState<S> => {
    if (event.type !== 'input') {
      if (state.playMode === 'telephone') {
        const next = base.reduce(state.selected, event);
        return next === state.selected ? state : upgradeTelephoneState(next);
      }
      const next = live.reduce(state.selected, event);
      return next === state.selected ? state : liveState(next);
    }
    const parsed = inputSchema.safeParse(event.input);
    if (!parsed.success || parsed.data.playMode !== state.playMode) return state;
    if (state.playMode === 'telephone' && parsed.data.playMode === 'telephone') {
      const next = base.reduce(state.selected, { ...event, input: parsed.data.input });
      return next === state.selected ? state : upgradeTelephoneState(next);
    }
    if (state.playMode === 'live-guessing' && parsed.data.playMode === 'live-guessing') {
      const next = live.reduce(state.selected, { ...event, input: parsed.data.input });
      return next === state.selected ? state : liveState(next);
    }
    return state;
  };

  return {
    manifest,
    phases: [...new Set([...base.phases, ...live.phases])],
    inputSchema,
    init: (ctx) =>
      readPlayMode(ctx.settings) === 'telephone'
        ? upgradeTelephoneState(base.init(telephoneContext(ctx)))
        : liveState(live.init(liveContext(ctx))),
    reduce,
    tvView: (state) =>
      state.playMode === 'telephone'
        ? { ...base.tvView(state.selected), gameId: manifest.id, playMode: 'telephone' }
        : { ...live.tvView(state.selected), gameId: manifest.id, playMode: 'live-guessing' },
    controllerView: (state, playerId) =>
      state.playMode === 'telephone'
        ? {
            ...base.controllerView(state.selected, playerId),
            gameId: manifest.id,
            playMode: 'telephone',
          }
        : {
            ...live.controllerView(state.selected, playerId),
            gameId: manifest.id,
            playMode: 'live-guessing',
          },
    results: (state) =>
      state.playMode === 'telephone' ? base.results(state.selected) : live.results(state.selected),
    bot: {
      sampleInput: (state, playerId, rng, skill) => {
        if (state.playMode === 'telephone') {
          const input = base.bot.sampleInput(state.selected, playerId, rng, skill);
          return input === null ? null : { type: 'mode-input', playMode: 'telephone', input };
        }
        const input = live.bot.sampleInput(state.selected, playerId, rng, skill);
        return input === null ? null : { type: 'mode-input', playMode: 'live-guessing', input };
      },
      ...(base.bot.llm || live.bot.llm
        ? {
            llm: {
              ask: (state: UpgradeState<S>, playerId: string) =>
                state.playMode === 'telephone'
                  ? (base.bot.llm?.ask(state.selected, playerId) ?? null)
                  : (live.bot.llm?.ask(state.selected, playerId) ?? null),
              answer: (
                state: UpgradeState<S>,
                playerId: string,
                reply: string,
              ): UpgradeInput<I> | null => {
                if (state.playMode === 'telephone') {
                  const input = base.bot.llm?.answer(state.selected, playerId, reply) ?? null;
                  return input === null
                    ? null
                    : { type: 'mode-input', playMode: 'telephone', input };
                }
                const input = live.bot.llm?.answer(state.selected, playerId, reply) ?? null;
                return input === null
                  ? null
                  : { type: 'mode-input', playMode: 'live-guessing', input };
              },
            },
          }
        : {}),
    },
    ...(base.recap || live.recap
      ? {
          recap: (state: UpgradeState<S>, ctx: RecapContext<UpgradeState<S>>) =>
            state.playMode === 'telephone'
              ? (base.recap?.(state.selected, telephoneHistory(ctx)) ?? null)
              : (live.recap?.(state.selected, liveHistory(ctx)) ?? null),
        }
      : {}),
    ...(base.stagePick
      ? {
          stagePick: {
            options: (settings: Settings) =>
              readPlayMode(settings) === 'telephone'
                ? base.stagePick!.options(telephoneSettings(settings))
                : [],
          },
        }
      : {}),
    ...(base.speech || live.speech
      ? {
          speech: (state: UpgradeState<S>) =>
            state.playMode === 'telephone'
              ? (base.speech?.(state.selected) ?? [])
              : (live.speech?.(state.selected) ?? []),
        }
      : {}),
    ...(base.speechCatalog || live.speechCatalog
      ? {
          speechCatalog: (opts: SpeechCatalogOptions) =>
            live.speechCatalog
              ? [...(base.speechCatalog?.(opts) ?? []), ...live.speechCatalog(opts)]
              : (base.speechCatalog?.(opts) ?? []),
        }
      : {}),
  };
}
