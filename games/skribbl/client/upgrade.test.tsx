import { renderToStaticMarkup } from 'react-dom/server';
import { lazy } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ControllerView, TvView } from '@partybox/game-sdk';
import type {
  GameControllerProps,
  GamePhoneModule,
  GameShared,
  GameTvModule,
  GameTvProps,
} from '@partybox/game-sdk/ui';
import { game } from '../server/index';
import type { DrawControllerView, DrawTvView, Input } from '../server/types';
import type { UpgradeControllerView, UpgradeInput, UpgradeTvView } from '../server/upgrade';
import { deepFreeze, drawing, guesser, kit } from '../__tests__/helpers';
import {
  createUpgradedPhone,
  createUpgradedTv,
  upgradePhoneModule,
  upgradeShared,
  upgradeTvModule,
} from './upgrade';

type BaseTvView = TvView & { caption: string };
type BaseControllerView = ControllerView & { caption: string };
type BaseInput = { type: 'caption'; text: string };

function BaseTv({ view }: GameTvProps<BaseTvView>) {
  return <p>Telephone TV: {view.caption}</p>;
}
function BaseController({ view }: GameControllerProps<BaseControllerView, BaseInput>) {
  return <p>Telephone phone: {view.caption}</p>;
}
function LiveTv({ view }: GameTvProps<DrawTvView>) {
  return <p>Live TV: {view.mask}</p>;
}
function LiveController({ view }: GameControllerProps<DrawControllerView, Input>) {
  return <p>Live phone: {view.mask}</p>;
}

const TvUpgrade = createUpgradedTv(BaseTv, LiveTv);
const PhoneUpgrade = createUpgradedPhone(BaseController, LiveController);
const start = kit.start();
const drawn = drawing();
const liveId = guesser(drawn);
const baseTv: GameTvProps<UpgradeTvView<BaseTvView>>['view'] = {
  ...game.tvView(start),
  vip: null,
  gameId: 'telephone-base',
  caption: 'A moon becomes a banana',
  playMode: 'telephone',
};
const basePhone: GameControllerProps<
  UpgradeControllerView<BaseControllerView>,
  UpgradeInput<BaseInput>
>['view'] = {
  ...game.controllerView(start, start.drawer),
  vip: null,
  gameId: 'telephone-base',
  caption: 'Describe this picture',
  playMode: 'telephone',
};
const liveTv: GameTvProps<UpgradeTvView<BaseTvView>>['view'] = {
  ...game.tvView(drawn),
  vip: null,
  gameId: 'telephone-base',
  playMode: 'live-guessing',
};
const livePhone: GameControllerProps<
  UpgradeControllerView<BaseControllerView>,
  UpgradeInput<BaseInput>
>['view'] = {
  ...game.controllerView(drawn, liveId),
  vip: null,
  gameId: 'telephone-base',
  playMode: 'live-guessing',
};

describe('injected telephone/live client surfaces', () => {
  it('delegates telephone TV to the exact base component with the exact pushed view and skip', () => {
    const skip = vi.fn();
    const element = TvUpgrade({ view: baseTv, skip });
    const props = element.props as GameTvProps<BaseTvView>;
    expect(element.type).toBe(BaseTv);
    expect(props.view).toBe(baseTv);
    expect(props.skip).toBe(skip);
    expect(props.view.gameId).toBe('telephone-base');
    expect(renderToStaticMarkup(element)).toContain('Telephone TV: A moon becomes a banana');
    expect(renderToStaticMarkup(element)).not.toContain('Live TV:');
  });

  it('delegates live TV without replacing the canonical game id or shell metadata', () => {
    const skip = vi.fn();
    const element = TvUpgrade({ view: liveTv, skip });
    const props = element.props as GameTvProps<DrawTvView>;
    expect(element.type).toBe(LiveTv);
    expect(props.view).toBe(liveTv);
    expect(props.skip).toBe(skip);
    expect(props.view.gameId).toBe('telephone-base');
    expect(renderToStaticMarkup(element)).toContain('Live TV:');
    expect(renderToStaticMarkup(element)).not.toContain('Telephone TV:');
  });

  it('preserves telephone component/view/player identity and wraps only its game input', () => {
    const send = vi.fn<(input: UpgradeInput<BaseInput>) => void>();
    const skip = vi.fn();
    const me = start.players[start.drawer]!;
    const element = PhoneUpgrade({ view: basePhone, me, send, skip });
    const props = element.props as GameControllerProps<BaseControllerView, BaseInput>;
    const input: BaseInput = { type: 'caption', text: 'A banana' };
    expect(element.type).toBe(BaseController);
    expect(props.view).toBe(basePhone);
    expect(props.me).toBe(me);
    expect(props.skip).toBe(skip);
    expect(renderToStaticMarkup(element)).toContain('Telephone phone: Describe this picture');
    props.send(input);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'mode-input', playMode: 'telephone', input });
    props.skip?.();
    expect(skip).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('routes live inputs through the live envelope and keeps VIP actions separate', () => {
    const send = vi.fn<(input: UpgradeInput<BaseInput>) => void>();
    const skip = vi.fn();
    const me = drawn.players[liveId]!;
    const element = PhoneUpgrade({ view: livePhone, me, send, skip });
    const props = element.props as GameControllerProps<DrawControllerView, Input>;
    const input: Input = { type: 'guess', text: 'moon', request: 41 };
    expect(element.type).toBe(LiveController);
    expect(props.view).toBe(livePhone);
    expect(props.me).toBe(me);
    expect(props.skip).toBe(skip);
    expect(props.view.gameId).toBe('telephone-base');
    expect(renderToStaticMarkup(element)).toContain('Live phone:');
    expect(renderToStaticMarkup(element)).not.toContain('Telephone phone:');
    props.send(input);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'mode-input', playMode: 'live-guessing', input });
    props.skip?.();
    expect(skip).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('keeps a stale component callback tagged with its original mode', () => {
    const send = vi.fn<(input: UpgradeInput<BaseInput>) => void>();
    const me = start.players[start.drawer]!;
    const telephone = PhoneUpgrade({ view: basePhone, me, send });
    const oldProps = telephone.props as GameControllerProps<BaseControllerView, BaseInput>;
    const live = PhoneUpgrade({ view: livePhone, me, send });
    const newProps = live.props as GameControllerProps<DrawControllerView, Input>;
    oldProps.send({ type: 'caption', text: 'Old caption' });
    newProps.send({ type: 'guess', text: 'Current guess' });
    expect(send.mock.calls.map(([input]) => input.playMode)).toEqual([
      'telephone',
      'live-guessing',
    ]);
  });
});

describe('per-mode injected shared configuration', () => {
  const base: GameShared = deepFreeze({
    id: 'telephone-base',
    scoreless: true,
    strings: { es: { 'Describe it': 'Descríbelo', 'Shared phrase': 'Original' } },
    sounds: { 'telephone-draw': 'phase', reveal: 'lock' },
    beds: { 'telephone-draw': 'telephone-bed' },
  });
  const live: GameShared = deepFreeze({
    id: 'skribbl',
    strings: { es: { 'Keep it secret!': '¡Guárdalo en secreto!', 'Shared phrase': 'Nuevo' } },
    sounds: { draw: 'phase', reveal: 'reveal' },
    beds: { draw: 'live-bed' },
  });

  it('preserves the exact existing shared object and nested references by default', () => {
    expect(upgradeShared(base, live)).toBe(base);
    expect(upgradeShared(base, live, 'telephone')).toBe(base);
    expect(upgradeShared(base, live).strings).toBe(base.strings);
    expect(upgradeShared(base, live).sounds).toBe(base.sounds);
    expect(upgradeShared(base, live).scoreless).toBe(true);
  });

  it('adds live strings and phase cues without losing base keys or its canonical identity', () => {
    const upgraded = upgradeShared(base, live, 'live-guessing');
    expect(upgraded.id).toBe('telephone-base');
    expect(upgraded.scoreless).toBe(false);
    expect(upgraded.strings?.es).toEqual({
      'Describe it': 'Descríbelo',
      'Keep it secret!': '¡Guárdalo en secreto!',
      'Shared phrase': 'Nuevo',
    });
    expect(upgraded.sounds).toEqual({ 'telephone-draw': 'phase', draw: 'phase', reveal: 'reveal' });
    expect(upgraded.beds).toEqual({ 'telephone-draw': 'telephone-bed', draw: 'live-bed' });
    expect(base.strings?.es?.['Shared phrase']).toBe('Original');
    expect(base.sounds?.['reveal']).toBe('lock');
    expect(base.scoreless).toBe(true);
    expect(live.id).toBe('skribbl');
  });

  it('honours an explicitly scoreless injected live edition and empty optional maps', () => {
    expect(upgradeShared(base, { ...live, scoreless: true }, 'live-guessing').scoreless).toBe(true);
    const minimal = upgradeShared({ id: 'base' }, { id: 'live' }, 'live-guessing');
    expect(minimal.id).toBe('base');
    expect(minimal.scoreless).toBe(false);
    expect(minimal.strings).toEqual({});
    expect(minimal.sounds).toEqual({});
    expect(minimal.beds).toEqual({});
  });

  it('does not carry telephone StagePick or view-dependent music into live mode', () => {
    const StagePick = () => <p>Telephone pick</p>;
    const scenes = vi.fn(() => null);
    const telephone: GameShared = {
      ...base,
      StagePick,
      music: { tracks: [], volume: 0.4, mode: 'chain', scenes },
    };
    expect(upgradeShared(telephone, live)).toBe(telephone);
    const upgraded = upgradeShared(telephone, live, 'live-guessing');
    expect(upgraded).not.toHaveProperty('StagePick');
    expect(upgraded).not.toHaveProperty('music');
    expect(scenes).not.toHaveBeenCalled();
  });
});

describe('complete per-mode shell modules', () => {
  const StagePick = () => <p>Telephone pick</p>;
  const Finale = lazy(async () => ({ default: () => <p>Telephone finale</p> }));
  const PhoneStage = lazy(async () => ({ default: () => <p>Telephone phone stage</p> }));
  const baseTvModule: GameTvModule = {
    id: 'telephone-base',
    Tv: BaseTv,
    StagePick,
    scoreless: true,
    music: { tracks: [], volume: 0.4, mode: 'chain', scenes: vi.fn(() => null) },
    sounds: { 'telephone-draw': 'phase' },
    strings: { es: { 'Describe it': 'Descríbelo' } },
    stripActive: vi.fn(() => ['telephone-player']),
    stripScores: vi.fn(() => false),
    finale: vi.fn(() => true),
    Finale,
    quickInto: ['telephone-draw'],
    keepMounted: true,
    stripOff: false,
    quietTimer: false,
  };
  const liveTvModule: GameTvModule = {
    id: 'skribbl',
    Tv: LiveTv,
    sounds: { draw: 'phase' },
    strings: { es: { 'Keep it secret!': '¡Guárdalo en secreto!' } },
    stripOff: true,
    quietTimer: true,
  };
  const basePhoneModule: GamePhoneModule = {
    id: 'telephone-base',
    Controller: BaseController,
    StagePick,
    scoreless: true,
    PhoneStage,
    phoneStagePhases: ['draw', 'reveal'],
    sounds: baseTvModule.sounds,
    strings: baseTvModule.strings,
    music: baseTvModule.music,
  };
  const livePhoneModule: GamePhoneModule = {
    id: 'skribbl',
    Controller: LiveController,
    sounds: liveTvModule.sounds,
    strings: liveTvModule.strings,
  };

  it('retains every telephone TV metadata value/reference and its injected component', () => {
    const upgraded = upgradeTvModule(baseTvModule, liveTvModule);
    for (const key of Object.keys(baseTvModule) as (keyof GameTvModule)[])
      if (key !== 'Tv') expect(upgraded[key]).toBe(baseTvModule[key]);
    const element = (upgraded.Tv as typeof TvUpgrade)({ view: baseTv });
    expect(element.type).toBe(BaseTv);
    expect(element.props.view).toBe(baseTv);
  });

  it('uses live TV metadata without telephone finale, strip, music or choreography hooks', () => {
    const upgraded = upgradeTvModule(baseTvModule, liveTvModule, 'live-guessing');
    expect(upgraded.id).toBe('telephone-base');
    expect(upgraded.scoreless).toBe(false);
    expect(upgraded.stripOff).toBe(true);
    expect(upgraded.quietTimer).toBe(true);
    for (const key of [
      'StagePick',
      'Finale',
      'finale',
      'stripActive',
      'stripScores',
      'music',
      'quickInto',
      'keepMounted',
    ])
      expect(upgraded).not.toHaveProperty(key);
    expect(upgraded.sounds).toEqual({ 'telephone-draw': 'phase', draw: 'phase' });
    const element = (upgraded.Tv as typeof TvUpgrade)({ view: liveTv });
    expect(element.type).toBe(LiveTv);
    expect(element.props.view).toBe(liveTv);
  });

  it('retains every telephone phone metadata value/reference and its injected component', () => {
    const upgraded = upgradePhoneModule(basePhoneModule, livePhoneModule);
    for (const key of Object.keys(basePhoneModule) as (keyof GamePhoneModule)[])
      if (key !== 'Controller') expect(upgraded[key]).toBe(basePhoneModule[key]);
    const element = (upgraded.Controller as typeof PhoneUpgrade)({
      view: basePhone,
      me: start.players[start.drawer]!,
      send: vi.fn(),
    });
    expect(element.type).toBe(BaseController);
    expect(element.props.view).toBe(basePhone);
  });

  it('uses the live controller stage without telephone PhoneStage, stage phases, music or StagePick', () => {
    const upgraded = upgradePhoneModule(basePhoneModule, livePhoneModule, 'live-guessing');
    expect(upgraded.id).toBe('telephone-base');
    expect(upgraded.scoreless).toBe(false);
    for (const key of ['PhoneStage', 'phoneStagePhases', 'StagePick', 'music'])
      expect(upgraded).not.toHaveProperty(key);
    expect(upgraded.strings?.es).toEqual({
      'Describe it': 'Descríbelo',
      'Keep it secret!': '¡Guárdalo en secreto!',
    });
    const element = (upgraded.Controller as typeof PhoneUpgrade)({
      view: livePhone,
      me: drawn.players[liveId]!,
      send: vi.fn(),
    });
    expect(element.type).toBe(LiveController);
    expect(element.props.view).toBe(livePhone);
  });
});
