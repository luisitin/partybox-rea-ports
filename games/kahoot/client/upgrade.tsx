import type { ComponentType, JSX } from 'react';
import type { ControllerView, TvView } from '@partybox/game-sdk';
import type {
  GameControllerProps,
  GamePhoneModule,
  GameShared,
  GameTvModule,
  GameTvProps,
  Strings,
} from '@partybox/game-sdk/ui';
import type { Input } from '../server/types';
import type { QuizControllerView, QuizTvView } from '../server/views';
import type {
  PlayMode,
  UpgradeControllerView,
  UpgradeInput,
  UpgradeTvView,
} from '../server/upgrade';

/** Inject each surface's own components; a phone entry never imports a TV entry. */
export function createUpgradedTv<V extends TvView>(
  ClassicTv: ComponentType<GameTvProps<V>>,
  QuizTv: ComponentType<GameTvProps<QuizTvView>>,
): (props: GameTvProps<UpgradeTvView<V>>) => JSX.Element {
  return function UpgradedTv(props): JSX.Element {
    return props.view.playMode === 'classic' ? (
      <ClassicTv {...props} view={props.view} />
    ) : (
      <QuizTv {...props} view={props.view} />
    );
  };
}
export function createUpgradedPhone<V extends ControllerView, I>(
  ClassicController: ComponentType<GameControllerProps<V, I>>,
  QuizController: ComponentType<GameControllerProps<QuizControllerView, Input>>,
): (props: GameControllerProps<UpgradeControllerView<V>, UpgradeInput<I>>) => JSX.Element {
  return function UpgradedPhone(props): JSX.Element {
    if (props.view.playMode === 'classic') {
      const send = (input: I): void =>
        props.send({ type: 'mode-input', playMode: 'classic', input });
      return <ClassicController {...props} view={props.view} send={send} />;
    }
    const mode = props.view.playMode;
    const send = (input: Input): void => props.send({ type: 'mode-input', playMode: mode, input });
    return <QuizController {...props} view={props.view} send={send} />;
  };
}
function mergeStrings(base: Strings | undefined, quiz: Strings | undefined): Strings {
  const merged: Strings = {};
  for (const lang of Object.keys({ ...base, ...quiz }) as (keyof Strings)[])
    merged[lang] = { ...base?.[lang], ...quiz?.[lang] };
  return merged;
}

/** Classic retains its exact shared object; opt-in starts with the complete selected sound plan. */
export function upgradeShared(
  base: GameShared,
  quiz: GameShared,
  playMode: PlayMode = 'classic',
): GameShared {
  return playMode === 'classic'
    ? base
    : {
        ...quiz,
        id: base.id,
        scoreless: quiz.scoreless ?? false,
        strings: mergeStrings(base.strings, quiz.strings),
      };
}
/** Cache once per mode, then select metadata by the same immutable mode carried in the view. */
export function upgradeTvModule(
  base: GameTvModule,
  quiz: GameTvModule,
  playMode: PlayMode = 'classic',
): GameTvModule {
  return {
    ...(playMode === 'classic' ? base : quiz),
    ...upgradeShared(base, quiz, playMode),
    Tv: createUpgradedTv(base.Tv, quiz.Tv),
  };
}
export function upgradePhoneModule(
  base: GamePhoneModule,
  quiz: GamePhoneModule,
  playMode: PlayMode = 'classic',
): GamePhoneModule {
  return {
    ...(playMode === 'classic' ? base : quiz),
    ...upgradeShared(base, quiz, playMode),
    Controller: createUpgradedPhone(base.Controller, quiz.Controller),
  };
}
