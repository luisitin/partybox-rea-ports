import type {
  GameDefinition,
  GameStateBase,
  RecapContext,
  SpeechCatalogOptions,
  Settings,
  TvView,
  ControllerView,
} from '@partybox/game-sdk';
import type { Input, State } from './types';
import type { QuizControllerView, QuizTvView } from './views';
import type {
  QuizUpgradeMode,
  UpgradeInput,
  UpgradeState,
  UpgradeTvView,
  UpgradeControllerView,
} from './upgrade';

function classicHistory<S extends GameStateBase>(
  ctx: RecapContext<UpgradeState<S>>,
): RecapContext<S> {
  return {
    ...ctx,
    history: ctx.history.flatMap((entry) =>
      entry.state.playMode === 'classic' ? [{ ...entry, state: entry.state.selected }] : [],
    ),
  };
}
function quizHistory<S extends GameStateBase>(
  ctx: RecapContext<UpgradeState<S>>,
  mode: QuizUpgradeMode,
): RecapContext<State> {
  return {
    ...ctx,
    history: ctx.history.flatMap((entry) =>
      entry.state.playMode !== 'classic' && entry.state.playMode === mode
        ? [{ ...entry, state: entry.state.selected }]
        : [],
    ),
  };
}
type Hooks<S extends GameStateBase, I, TV extends TvView, CV extends ControllerView> = Pick<
  GameDefinition<UpgradeState<S>, UpgradeInput<I>, UpgradeTvView<TV>, UpgradeControllerView<CV>>,
  'bot' | 'recap' | 'stagePick' | 'speech' | 'speechCatalog'
>;

/** Delegate optional hooks without exposing the private selected state to any view. */
export function upgradeHooks<
  S extends GameStateBase,
  I,
  TV extends TvView,
  CV extends ControllerView,
>(
  base: GameDefinition<S, I, TV, CV>,
  quiz: GameDefinition<State, Input, QuizTvView, QuizControllerView>,
  classicSettings: (settings: Settings) => Settings,
): Hooks<S, I, TV, CV> {
  return {
    bot: {
      sampleInput: (state, id, rng, skill) => {
        if (state.playMode === 'classic') {
          const input = base.bot.sampleInput(state.selected, id, rng, skill);
          return input === null ? null : { type: 'mode-input', playMode: 'classic', input };
        }
        const input = quiz.bot.sampleInput(state.selected, id, rng, skill);
        return input === null ? null : { type: 'mode-input', playMode: state.playMode, input };
      },
      ...(base.bot.llm || quiz.bot.llm
        ? {
            llm: {
              ask: (state: UpgradeState<S>, id: string) =>
                state.playMode === 'classic'
                  ? (base.bot.llm?.ask(state.selected, id) ?? null)
                  : (quiz.bot.llm?.ask(state.selected, id) ?? null),
              answer: (
                state: UpgradeState<S>,
                id: string,
                reply: string,
              ): UpgradeInput<I> | null => {
                if (state.playMode === 'classic') {
                  const input = base.bot.llm?.answer(state.selected, id, reply) ?? null;
                  return input === null ? null : { type: 'mode-input', playMode: 'classic', input };
                }
                const input = quiz.bot.llm?.answer(state.selected, id, reply) ?? null;
                return input === null
                  ? null
                  : { type: 'mode-input', playMode: state.playMode, input };
              },
            },
          }
        : {}),
    },
    ...(base.recap || quiz.recap
      ? {
          recap: (state: UpgradeState<S>, ctx: RecapContext<UpgradeState<S>>) =>
            state.playMode === 'classic'
              ? (base.recap?.(state.selected, classicHistory(ctx)) ?? null)
              : (quiz.recap?.(state.selected, quizHistory(ctx, state.playMode)) ?? null),
        }
      : {}),
    ...(base.stagePick
      ? {
          stagePick: {
            options: (settings) =>
              settings.playMode === 'teams' || settings.playMode === 'tv-vote'
                ? []
                : base.stagePick!.options(classicSettings(settings)),
          },
        }
      : {}),
    ...(base.speech || quiz.speech
      ? {
          speech: (state: UpgradeState<S>) =>
            state.playMode === 'classic'
              ? (base.speech?.(state.selected) ?? [])
              : (quiz.speech?.(state.selected) ?? []),
        }
      : {}),
    ...(base.speechCatalog || quiz.speechCatalog
      ? {
          speechCatalog: (opts: SpeechCatalogOptions) =>
            quiz.speechCatalog
              ? [...(base.speechCatalog?.(opts) ?? []), ...quiz.speechCatalog(opts)]
              : (base.speechCatalog?.(opts) ?? []),
        }
      : {}),
  };
}
