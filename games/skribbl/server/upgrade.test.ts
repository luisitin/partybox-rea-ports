import { describe, expect, it } from 'vitest';
import { createRng, playerCountRange } from '@partybox/game-sdk';
import type { Settings } from '@partybox/game-sdk';
import { game as live } from './index';
import {
  createSkribblUpgrade,
  readPlayMode,
  upgradeModeInfo,
  upgradeTelephoneState,
} from './upgrade';
import type { UpgradeInput } from './upgrade';
import { upgradeFixture as fixture } from '../__tests__/upgrade-helpers';
import type { BaseInput } from '../__tests__/upgrade-helpers';
describe('injected drawing-game upgrade', () => {
  it('preserves the base card, telephone settings and mode-dependent player bounds', () => {
    const { base, upgrade } = fixture();
    expect(upgrade.manifest.id).toBe(base.manifest.id);
    expect(upgrade.manifest.name).toBe(base.manifest.name);
    expect(upgrade.manifest.howToPlay).toEqual(base.manifest.howToPlay);
    expect(upgrade.manifest.settings.slice(0, 2)).toEqual(base.manifest.settings);
    expect(upgrade.manifest.settings.map((setting) => setting.key)).toEqual([
      'drawSeconds',
      'baseSetting',
      'playMode',
      'liveLaps',
      'liveDrawSeconds',
      'liveDifficulty',
    ]);
    expect(playerCountRange(upgrade.manifest, {})).toEqual([3, 8]);
    expect(playerCountRange(upgrade.manifest, { playMode: 'telephone' })).toEqual([3, 8]);
    expect(playerCountRange(upgrade.manifest, { playMode: 'live-guessing' })).toEqual([2, 8]);
    expect(playerCountRange(upgrade.manifest, { playMode: 'stale-mode' })).toEqual([3, 8]);
    expect(readPlayMode({ playMode: '__proto__' })).toBe('telephone');
    const telephone = upgradeModeInfo(base.manifest, 'telephone', true);
    const guessing = upgradeModeInfo(base.manifest, 'live-guessing', true);
    expect(telephone.howToPlay).toBe(base.manifest.howToPlay);
    expect(telephone.contentLangs).toEqual(['en', 'es']);
    expect(telephone.scoreless).toBe(true);
    expect(guessing.howToPlay).toBe(live.manifest.howToPlay);
    expect(guessing.contentLangs).toEqual(['en']);
    expect(guessing.scoreless).toBe(false);
  });

  it('keeps unmodified default init context and selected base state by reference', () => {
    const { hooks, ctx, upgrade } = fixture();
    const state = upgrade.init(ctx);
    expect(hooks.init).toHaveBeenCalledWith(ctx);
    expect(hooks.init.mock.calls[0]![0]).toBe(ctx);
    expect(state.selected).toBe(hooks.init.mock.results[0]!.value);
    expect(state.playMode).toBe('telephone');
    expect(state.phase).toBe(state.selected.phase);
    expect(state.rng).toBe(state.selected.rng);
    expect(state.players).toBe(state.selected.players);
    expect(upgradeTelephoneState(hooks.init(ctx)).selected).toBe(
      hooks.init.mock.results.at(-1)!.value,
    );
  });

  it('isolates live settings from the existing drawing-time preference and retains other context', () => {
    const { hooks, ctx, upgrade } = fixture();
    const settings: Settings = {
      ...ctx.settings,
      playMode: 'telephone',
      liveLaps: 2,
      liveDrawSeconds: 30,
      liveDifficulty: 'hard',
    };
    upgrade.init({ ...ctx, settings });
    expect(hooks.init.mock.calls.at(-1)![0]).toEqual(ctx);
    const liveState = upgrade.init({
      ...ctx,
      settings: { ...settings, playMode: 'live-guessing' },
    });
    if (liveState.playMode !== 'live-guessing') throw new Error('Expected live mode');
    expect(liveState.selected.settings).toEqual({ laps: 2, drawSeconds: 30, difficulty: 'hard' });
    expect(liveState.selected.phoneOnly).toBe(true);
    expect(liveState.selected.order).toHaveLength(ctx.players.length * 2);
    expect(settings.drawSeconds).toBe(110);
    expect(upgrade.stagePick?.options(settings)).toEqual(['110']);
    expect(hooks.options.mock.calls.at(-1)![0]).toEqual(ctx.settings);
    expect(upgrade.stagePick?.options({ playMode: 'live-guessing' })).toEqual([]);
  });

  it('rejects cross-mode, unwrapped and malformed inputs without touching either reducer or mirrors', () => {
    const { hooks, ctx, upgrade } = fixture();
    const telephone = upgrade.init(ctx);
    const active = upgrade.init({ ...ctx, settings: { playMode: 'live-guessing' } });
    const event = (input: unknown) => ({
      type: 'input' as const,
      now: ctx.now + 1,
      playerId: 'p1',
      input: input as UpgradeInput<BaseInput>,
    });
    for (const input of [
      { type: 'mode-input', playMode: 'live-guessing', input: { type: 'choose', index: 0 } },
      { type: 'mode-input', playMode: 'telephone', input: { type: 'add', amount: 999 } },
      { type: 'add', amount: 1 },
      null,
    ])
      expect(upgrade.reduce(telephone, event(input))).toBe(telephone);
    const stale = { type: 'mode-input', playMode: 'telephone', input: { type: 'add', amount: 2 } };
    expect(upgrade.reduce(active, event(stale))).toBe(active);
    expect(hooks.reduce).not.toHaveBeenCalled();
    expect(upgrade.inputSchema.safeParse(stale).success).toBe(true);
    expect(upgrade.inputSchema.safeParse({ ...stale, unexpected: 'field' }).success).toBe(false);
  });

  it('delegates valid base events, player changes and timers, mirroring every returned state', () => {
    const { hooks, ctx, upgrade } = fixture();
    let state = upgrade.init(ctx);
    state = upgrade.reduce(state, {
      type: 'input',
      now: ctx.now + 1,
      playerId: 'p1',
      vip: true,
      input: { type: 'mode-input', playMode: 'telephone', input: { type: 'add', amount: 3 } },
    });
    if (state.playMode !== 'telephone') throw new Error('Expected telephone');
    expect(state.selected.units).toBe(3);
    expect(hooks.reduce.mock.calls.at(-1)![1]).toEqual({
      type: 'input',
      now: ctx.now + 1,
      playerId: 'p1',
      vip: true,
      input: { type: 'add', amount: 3 },
    });
    expect(state.rng).toBe(state.selected.rng);
    const stale = {
      type: 'timer' as const,
      now: ctx.now + 100,
      phaseId: 'old',
      startedAt: ctx.now,
    };
    expect(upgrade.reduce(state, stale)).toBe(state);
    state = upgrade.reduce(state, {
      type: 'player',
      now: ctx.now + 2,
      playerId: 'p2',
      connected: false,
    });
    expect(state.players).toBe(state.selected.players);
    expect(state.players.p2?.connected).toBe(false);
    state = upgrade.reduce(state, {
      type: 'timer',
      now: state.phase.deadline!,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
    expect(state.phase).toBe(state.selected.phase);
    expect(state.phase.id).toBe('done');
    const result = upgrade.results(state);
    expect(result).toBe(hooks.results.mock.results.at(-1)!.value);
  });

  it('tags safe delegated views under the existing canonical game identity', () => {
    const { ctx, upgrade } = fixture();
    const telephone = upgrade.init(ctx);
    const active = upgrade.init({ ...ctx, settings: { playMode: 'live-guessing' } });
    for (const state of [telephone, active]) {
      const tv = upgrade.tvView(state);
      const controller = upgrade.controllerView(state, 'p2');
      expect(tv.gameId).toBe('existing-game');
      expect(controller.gameId).toBe('existing-game');
      expect(tv.playMode).toBe(state.playMode);
      expect(controller.playMode).toBe(state.playMode);
      expect(tv).not.toHaveProperty('selected');
      expect(tv).not.toHaveProperty('secret');
      expect(tv).not.toHaveProperty('choices');
    }
    if (active.playMode !== 'live-guessing') throw new Error('Expected live mode');
    const other = ctx.players.find((player) => player.id !== active.selected.drawer)!.id;
    expect(upgrade.controllerView(active, other)).not.toHaveProperty('choices');
    expect(upgrade.controllerView(active, active.selected.drawer)).toHaveProperty('choices');
  });

  it('passes bot RNG/skill and optional LLM, recap and speech hooks through unchanged', () => {
    const { hooks, ctx, upgrade } = fixture();
    const state = upgrade.init(ctx);
    const rng = createRng(2);
    const input = upgrade.bot.sampleInput(state, 'p1', rng, 'sharp');
    expect(hooks.sampleInput).toHaveBeenCalledWith(state.selected, 'p1', rng, 'sharp');
    expect(input?.playMode).toBe('telephone');
    expect(input?.input).toBe(hooks.sampleInput.mock.results.at(-1)!.value);
    expect(upgrade.bot.llm?.ask(state, 'p1')).toBe(hooks.ask.mock.results.at(-1)!.value);
    expect(upgrade.bot.llm?.answer(state, 'p1', 'reply')?.input).toBe(
      hooks.answer.mock.results.at(-1)!.value,
    );
    const readings = upgrade.speech?.(state);
    expect(readings).toBe(hooks.speech.mock.results.at(-1)!.value);
    const catalog = upgrade.speechCatalog?.({ voice: 'test', contentLang: 'en' });
    expect(catalog).toBe(hooks.speechCatalog.mock.results.at(-1)!.value);
    const context = {
      players: ctx.players,
      results: null,
      history: [{ phase: 'work', at: ctx.now, state }],
    };
    expect(upgrade.recap?.(state, context)).toBe(hooks.recap.mock.results.at(-1)!.value);
    expect(hooks.recap.mock.calls.at(-1)![1].history[0]!.state).toBe(state.selected);
    hooks.sampleInput.mockReturnValueOnce(null);
    expect(upgrade.bot.sampleInput(state, 'p1', rng)).toBeNull();
    const active = upgrade.init({ ...ctx, settings: { playMode: 'live-guessing' } });
    expect(upgrade.bot.llm?.ask(active, 'p1')).toBeNull();
    expect(upgrade.bot.llm?.answer(active, 'p1', 'old telephone reply')).toBeNull();
  });

  it('refuses setting/range conflicts instead of silently changing an existing variant', () => {
    const { base } = fixture();
    expect(() =>
      createSkribblUpgrade({
        ...base,
        manifest: {
          ...base.manifest,
          settings: [{ key: 'playMode', label: 'Existing mode', type: 'boolean', default: false }],
        },
      }),
    ).toThrow('conflict');
    expect(() =>
      createSkribblUpgrade({
        ...base,
        manifest: {
          ...base.manifest,
          playerCounts: { setting: 'other', default: [3, 8], overrides: {} },
        },
      }),
    ).toThrow('player range');
    expect(() =>
      createSkribblUpgrade({ ...base, manifest: { ...base.manifest, maxInputBytes: 262_144 } }),
    ).toThrow('input cap');
  });
});
