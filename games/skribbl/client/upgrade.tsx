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
import type { DrawControllerView, DrawTvView, Input } from '../server/types';
import type {
  PlayMode,
  UpgradeControllerView,
  UpgradeInput,
  UpgradeTvView,
} from '../server/upgrade';

/** Inject components from their own entry points so a phone never downloads a TV module. */
export function createUpgradedTv<BaseView extends TvView>(
  BaseTv: ComponentType<GameTvProps<BaseView>>,
  LiveTv: ComponentType<GameTvProps<DrawTvView>>,
): (props: GameTvProps<UpgradeTvView<BaseView>>) => JSX.Element {
  return function UpgradedTv(props): JSX.Element {
    return props.view.playMode === 'live-guessing' ? (
      <LiveTv {...props} view={props.view} />
    ) : (
      <BaseTv {...props} view={props.view} />
    );
  };
}

/** Keep each pushed view intact; only game inputs are wrapped, never the shell's VIP skip. */
export function createUpgradedPhone<BaseView extends ControllerView, BaseInput>(
  BaseController: ComponentType<GameControllerProps<BaseView, BaseInput>>,
  LiveController: ComponentType<GameControllerProps<DrawControllerView, Input>>,
): (
  props: GameControllerProps<UpgradeControllerView<BaseView>, UpgradeInput<BaseInput>>,
) => JSX.Element {
  return function UpgradedController(props): JSX.Element {
    if (props.view.playMode === 'live-guessing') {
      const send = (input: Input): void =>
        props.send({ type: 'mode-input', playMode: 'live-guessing', input });
      return <LiveController {...props} view={props.view} send={send} />;
    }
    const send = (input: BaseInput): void =>
      props.send({ type: 'mode-input', playMode: 'telephone', input });
    return <BaseController {...props} view={props.view} send={send} />;
  };
}

function mergeStrings(base: Strings | undefined, live: Strings | undefined): Strings {
  const strings: Strings = {};
  for (const lang of Object.keys({ ...base, ...live }) as (keyof Strings)[]) {
    strings[lang] = { ...base?.[lang], ...live?.[lang] };
  }
  return strings;
}

/**
 * Select once from the running game's mode, alongside the server's mode metadata.
 * Telephone keeps the exact existing object; live adds its vocabulary/cues under the base id.
 * Live values win collisions only in live mode. Its score-bearing results must not inherit a
 * telephone module's scoreless flag. The injected component references are never substituted.
 */
export function upgradeShared(
  base: GameShared,
  live: GameShared,
  playMode: PlayMode = 'telephone',
): GameShared {
  if (playMode !== 'live-guessing') return base;
  return {
    ...live,
    id: base.id,
    scoreless: live.scoreless ?? false,
    strings: mergeStrings(base.strings, live.strings),
    sounds: { ...base.sounds, ...live.sounds },
    beds: { ...base.beds, ...live.beds },
  };
}

/** Build once per mode in the TV entry; preserve that mode's complete shell configuration. */
export function upgradeTvModule(
  base: GameTvModule,
  live: GameTvModule,
  playMode: PlayMode = 'telephone',
): GameTvModule {
  const selected = playMode === 'live-guessing' ? live : base;
  return {
    ...selected,
    ...upgradeShared(base, live, playMode),
    Tv: createUpgradedTv(base.Tv, live.Tv),
  };
}

/** Live mode cannot inherit a telephone PhoneStage or its phase list; its controller is the stage. */
export function upgradePhoneModule(
  base: GamePhoneModule,
  live: GamePhoneModule,
  playMode: PlayMode = 'telephone',
): GamePhoneModule {
  const selected = playMode === 'live-guessing' ? live : base;
  return {
    ...selected,
    ...upgradeShared(base, live, playMode),
    Controller: createUpgradedPhone(base.Controller, live.Controller),
  };
}
