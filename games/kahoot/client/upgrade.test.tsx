import { lazy } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ControllerView, TvView } from '@partybox/game-sdk';
import type {
  GameControllerProps,
  GamePhoneModule,
  GameShared,
  GameTvModule,
  GameTvProps,
} from '@partybox/game-sdk/ui';
import { testPlayers } from '@partybox/game-sdk/testing';
import { makeClassic } from '../__tests__/upgrade-fixture';
import { game } from '../server/index';
import type { Input } from '../server/types';
import type { QuizControllerView, QuizTvView } from '../server/views';
import type { PlayMode, UpgradeInput } from '../server/upgrade';
import {
  createUpgradedPhone,
  createUpgradedTv,
  upgradePhoneModule,
  upgradeShared,
  upgradeTvModule,
} from './upgrade';

const sharedClassic: GameShared = {
  id: 'existing-quiz',
  scoreless: true,
  strings: { es: { Shared: 'Clásico', Classic: 'Original' } },
  sounds: { question: 'phase', wager: 'wager' },
  beds: { wager: 'warm' },
  music: { tracks: ['original-track'], volume: 0.07, mode: 'chain' },
  StagePick: () => <span>Original choice</span>,
};
const sharedQuiz: GameShared = {
  id: 'kahoot',
  strings: { es: { Shared: 'Equipos', Quiz: 'Nuevo' } },
  sounds: { talk: 'phase', reveal: 'reveal' },
  beds: { question: 'pulse' },
};
const Finale = lazy(async () => ({ default: () => <span>Original finale</span> }));
const PhoneStage = lazy(async () => ({ default: () => <span>Original stage</span> }));
const baseTv: GameTvModule = {
  ...sharedClassic,
  Tv: () => <span>Classic TV</span>,
  Finale,
  finale: () => true,
  irisInto: ['reveal'],
  stripActive: () => ['p1'],
  stripScores: () => true,
};
const quizTv: GameTvModule = {
  ...sharedQuiz,
  Tv: () => <span>Quiz TV</span>,
  quickInto: ['talk', 'reveal'],
  stripScores: () => false,
};
const basePhone: GamePhoneModule = {
  ...sharedClassic,
  Controller: () => <span>Classic phone</span>,
  PhoneStage,
  phoneStagePhases: ['reveal'],
};
const quizPhone: GamePhoneModule = { ...sharedQuiz, Controller: () => <span>Quiz phone</span> };

describe('selected existing-card client modules', () => {
  it('keeps the exact classic shared object and every classic metadata reference', () => {
    expect(upgradeShared(sharedClassic, sharedQuiz)).toBe(sharedClassic);
    const tv = upgradeTvModule(baseTv, quizTv);
    expect(tv.id).toBe(sharedClassic.id);
    expect(tv.Finale).toBe(Finale);
    expect(tv.finale).toBe(baseTv.finale);
    expect(tv.stripActive).toBe(baseTv.stripActive);
    expect(tv.stripScores).toBe(baseTv.stripScores);
    expect(tv.irisInto).toBe(baseTv.irisInto);
    expect(tv.music).toBe(sharedClassic.music);
    expect(tv.sounds).toBe(sharedClassic.sounds);
    expect(tv.beds).toBe(sharedClassic.beds);
    expect(tv.StagePick).toBe(sharedClassic.StagePick);
    const phone = upgradePhoneModule(basePhone, quizPhone);
    expect(phone.PhoneStage).toBe(PhoneStage);
    expect(phone.phoneStagePhases).toBe(basePhone.phoneStagePhases);
  });

  it('selects complete team/vote metadata without leaking classic hooks or sound plans', () => {
    for (const mode of ['teams', 'tv-vote'] as PlayMode[]) {
      const shared = upgradeShared(sharedClassic, sharedQuiz, mode);
      expect(shared.id).toBe(sharedClassic.id);
      expect(shared.scoreless).toBe(false);
      expect(shared.sounds).toBe(sharedQuiz.sounds);
      expect(shared.beds).toBe(sharedQuiz.beds);
      expect(shared).not.toHaveProperty('music');
      expect(shared).not.toHaveProperty('StagePick');
      expect(shared.strings?.es).toEqual({ Shared: 'Equipos', Classic: 'Original', Quiz: 'Nuevo' });
      const tv = upgradeTvModule(baseTv, quizTv, mode);
      expect(tv.quickInto).toBe(quizTv.quickInto);
      expect(tv.stripScores).toBe(quizTv.stripScores);
      for (const key of ['Finale', 'finale', 'stripActive', 'irisInto', 'music', 'StagePick'])
        expect(tv).not.toHaveProperty(key);
      const phone = upgradePhoneModule(basePhone, quizPhone, mode);
      expect(phone).not.toHaveProperty('PhoneStage');
      expect(phone).not.toHaveProperty('phoneStagePhases');
      expect(phone).not.toHaveProperty('music');
    }
  });
});

describe('injected component routing', () => {
  it('passes classic TV/phone views, me and VIP skip by reference while tagging only game inputs', () => {
    const { game: base } = makeClassic();
    const state = base.init({ players: testPlayers(2), settings: {}, seed: 1, now: 1_000 });
    const tvView = { ...base.tvView(state), playMode: 'classic' as const, vip: null };
    const phoneView = {
      ...base.controllerView(state, 'p1'),
      playMode: 'classic' as const,
      vip: null,
    };
    const me = { id: 'p1', name: 'Owner', avatarId: '' };
    const skip = () => undefined;
    const sent: UpgradeInput<{ type: 'pick'; value: number }>[] = [];
    const Tv = createUpgradedTv<TvView>(
      (props) => {
        expect(props.view).toBe(tvView);
        expect(props.skip).toBe(skip);
        return <span>Existing TV</span>;
      },
      () => <span>Wrong mode</span>,
    );
    expect(renderToStaticMarkup(<Tv view={tvView} skip={skip} />)).toBe('<span>Existing TV</span>');
    const Phone = createUpgradedPhone<ControllerView, { type: 'pick'; value: number }>(
      (props) => {
        expect(props.view).toBe(phoneView);
        expect(props.me).toBe(me);
        expect(props.skip).toBe(skip);
        props.send({ type: 'pick', value: 2 });
        return <span>Existing phone</span>;
      },
      () => <span>Wrong mode</span>,
    );
    expect(
      renderToStaticMarkup(
        <Phone view={phoneView} me={me} skip={skip} send={(input) => sent.push(input)} />,
      ),
    ).toBe('<span>Existing phone</span>');
    expect(sent).toEqual([
      { type: 'mode-input', playMode: 'classic', input: { type: 'pick', value: 2 } },
    ]);
  });

  for (const mode of ['teams', 'tv-vote'] as const)
    it(`routes ${mode} with intact private view and stable callback mode`, () => {
      const state = game.init({
        players: testPlayers(4),
        settings: { mode, rounds: 5 },
        seed: 1,
        now: 1_000,
      });
      const view = {
        ...game.controllerView(state, 'p1'),
        gameId: sharedClassic.id,
        playMode: mode,
        vip: null,
      };
      const tvView = { ...game.tvView(state), gameId: sharedClassic.id, playMode: mode, vip: null };
      const me = { id: 'p1', name: 'Owner', avatarId: '' };
      const skip = () => undefined;
      let callback: ((input: Input) => void) | undefined;
      const sent: UpgradeInput<{ type: 'pick'; value: number }>[] = [];
      const Phone = createUpgradedPhone<ControllerView, { type: 'pick'; value: number }>(
        () => <span>Wrong mode</span>,
        (props: GameControllerProps<QuizControllerView, Input>) => {
          expect(props.view).toBe(view);
          expect(props.me).toBe(me);
          expect(props.skip).toBe(skip);
          callback = props.send;
          return <span>Quiz phone</span>;
        },
      );
      expect(
        renderToStaticMarkup(
          <Phone view={view} me={me} skip={skip} send={(input) => sent.push(input)} />,
        ),
      ).toBe('<span>Quiz phone</span>');
      callback!({ type: 'answer', round: 1, choice: 3 });
      expect(sent).toEqual([
        { type: 'mode-input', playMode: mode, input: { type: 'answer', round: 1, choice: 3 } },
      ]);
      const Tv = createUpgradedTv<TvView>(
        () => <span>Wrong mode</span>,
        (props: GameTvProps<QuizTvView>) => {
          expect(props.view).toBe(tvView);
          expect(props.skip).toBe(skip);
          return <span>Quiz TV</span>;
        },
      );
      expect(renderToStaticMarkup(<Tv view={tvView} skip={skip} />)).toBe('<span>Quiz TV</span>');
    });
});
