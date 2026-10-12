import { describe, expect, it } from 'vitest';
import { createRng, playerCountRange } from '@partybox/game-sdk';
import type { InitContext } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { makeClassic } from '../__tests__/upgrade-fixture';
import type { ClassicInput } from '../__tests__/upgrade-fixture';
import { createKahootUpgrade, readPlayMode, upgradeClassicState, upgradeModeInfo } from './upgrade';
import type { UpgradeInput } from './upgrade';

const context = (settings: InitContext['settings'] = {}, n = 2): InitContext => ({
  players: testPlayers(n),
  settings,
  seed: 5,
  now: 1_000,
});

describe('existing-card upgrade boundary', () => {
  it('preserves classic identity/defaults/languages/minigame and its1–16 roster', () => {
    const { game: base } = makeClassic();
    const game = createKahootUpgrade(base);
    expect(game.manifest.id).toBe(base.manifest.id);
    expect(game.manifest.name).toBe(base.manifest.name);
    expect(game.manifest.howToPlay).toEqual(base.manifest.howToPlay);
    expect(game.manifest.contentLangs).toEqual(['en', 'es']);
    expect(game.manifest.minigame).toEqual(base.manifest.minigame);
    expect(game.manifest.estimate).toEqual(base.manifest.estimate);
    expect(game.manifest.settings.find((s) => s.key === 'answerSeconds')?.default).toBe(15);
    expect(playerCountRange(game.manifest, {})).toEqual([1, 16]);
    expect(playerCountRange(game.manifest, { playMode: 'teams' })).toEqual([2, 8]);
    expect(playerCountRange(game.manifest, { playMode: 'tv-vote' })).toEqual([2, 8]);
    expect(game.manifest.settings.find((s) => s.key === 'playMode')).toMatchObject({
      default: 'classic',
      options: [{ value: 'classic' }, { value: 'teams' }, { value: 'tv-vote' }],
    });
    expect(readPlayMode({ playMode: 'solo' })).toBe('classic');
    expect(readPlayMode({ playMode: 'unknown' })).toBe('classic');
  });

  it('retains exact unmodified classic context/selected timer/RNG/player references', () => {
    const { game: base, seen } = makeClassic();
    const game = createKahootUpgrade(base);
    const ctx = {
      ...context({}, 1),
      contentLang: 'es' as const,
      presence: { mode: 'together' as const, phoneOnly: true },
      picks: { p1: 'one' },
    };
    const state = game.init(ctx);
    expect(seen.init).toBe(ctx);
    expect(state.playMode).toBe('classic');
    expect(state.phase).toBe(state.selected.phase);
    expect(state.rng).toBe(state.selected.rng);
    expect(state.players).toBe(state.selected.players);
    expect(upgradeClassicState(state.selected).selected).toBe(state.selected);
  });

  it('strips only reserved quiz settings and leaves classic context fields intact', () => {
    const { game: base, seen } = makeClassic();
    const game = createKahootUpgrade(base);
    const ctx = context({
      playMode: 'classic',
      questions: 7,
      answerSeconds: 25,
      quizPack: 'music',
      quizRounds: 20,
      quizSeconds: 10,
      quizTeamCount: 4,
      quizTalkSeconds: 8,
      unrelated: 'keep',
    });
    game.init(ctx);
    expect(seen.init?.settings).toEqual({ questions: 7, answerSeconds: 25, unrelated: 'keep' });
    expect(seen.init?.players).toBe(ctx.players);
    expect(ctx.settings.quizPack).toBe('music');
  });

  it('validates/tag-routes inputs and returns the identical wrapper for malformed or cross-mode events', () => {
    const { game: base, seen } = makeClassic();
    const game = createKahootUpgrade(base);
    const state = game.init(context());
    const rejected = [
      { type: 'pick', value: 1 },
      { type: 'mode-input', playMode: 'solo', input: { type: 'pick', value: 1 } },
      { type: 'mode-input', playMode: 'classic', input: { type: 'pick', value: 9 } },
      { type: 'mode-input', playMode: 'teams', input: { type: 'answer', round: 1, choice: 0 } },
      { type: 'mode-input', playMode: 'classic', input: { type: 'pick', value: 1 }, extra: true },
    ];
    for (const input of rejected)
      expect(
        game.reduce(state, {
          type: 'input',
          now: 1_010,
          playerId: 'p1',
          input: input as UpgradeInput<ClassicInput>,
        }),
      ).toBe(state);
    expect(seen.reduce).toBeUndefined();
    const unchanged = game.reduce(state, {
      type: 'input',
      now: 1_010,
      playerId: 'p1',
      input: { type: 'mode-input', playMode: 'classic', input: { type: 'pick', value: 0 } },
    });
    expect(unchanged).toBe(state);
    const after = game.reduce(state, {
      type: 'input',
      now: 1_020,
      playerId: 'p1',
      input: { type: 'mode-input', playMode: 'classic', input: { type: 'pick', value: 2 } },
    });
    expect(after.selected).toMatchObject({ marker: 2 });
    expect(seen.reduce?.state).toBe(state.selected);
    expect(seen.reduce?.event).toMatchObject({ input: { type: 'pick', value: 2 } });
  });

  it('delegates non-input host actions/results and retains classic privacy', () => {
    const { game: base } = makeClassic();
    const game = createKahootUpgrade(base);
    const state = game.init(context());
    expect(game.tvView(state)).not.toHaveProperty('secret');
    expect(game.controllerView(state, 'p2')).not.toHaveProperty('secret');
    expect(game.controllerView(state, 'p1')).toMatchObject({
      gameId: base.manifest.id,
      playMode: 'classic',
      secret: 'hidden classic answer',
    });
    const ended = game.reduce(state, { type: 'vip', action: 'end', now: 1_030 });
    expect(ended.phase).toBe(ended.selected.phase);
    expect(game.results(ended)).toEqual(
      base.results(ended.selected as Parameters<typeof base.results>[0]),
    );
  });

  it('delegates bot RNG/skill, LLM, recap history, stage picks and speech', () => {
    const { game: base, seen, readings, ask, options } = makeClassic();
    const game = createKahootUpgrade(base);
    const state = game.init(context());
    const rng = createRng(12);
    expect(game.bot.sampleInput(state, 'p1', rng, 'sharp')).toMatchObject({
      type: 'mode-input',
      playMode: 'classic',
    });
    expect(seen.bot?.state).toBe(state.selected);
    expect(seen.bot?.rng).toBe(rng);
    expect(seen.bot?.skill).toBe('sharp');
    expect(game.bot.llm?.ask(state, 'p1')).toBe(ask);
    expect(game.bot.llm?.answer(state, 'p1', 'answer')).toEqual({
      type: 'mode-input',
      playMode: 'classic',
      input: { type: 'pick', value: 1 },
    });
    expect(game.bot.llm?.answer(state, 'p1', 'none')).toBeNull();
    expect(
      game.recap?.(state, {
        players: context().players,
        history: [{ phase: 'classic', at: 1_000, state }],
        results: null,
      }),
    ).toEqual({ markdown: 'Classic 0' });
    expect(seen.recap?.ctx.history[0]?.state).toBe(state.selected);
    const raw = { questions: 10 };
    expect(game.stagePick?.options(raw)).toBe(options);
    expect(seen.stage).toBe(raw);
    expect(game.stagePick?.options({ ...raw, quizRounds: 5, playMode: 'classic' })).toBe(options);
    expect(seen.stage).toEqual(raw);
    expect(game.stagePick?.options({ playMode: 'teams' })).toEqual([]);
    expect(game.speech?.(state)).toBe(readings);
    expect(game.speechCatalog?.({ voice: 'original', contentLang: 'es' })).toBe(readings);
  });

  it('selects exact classic opening metadata and opt-in English/points metadata', () => {
    const { game: base } = makeClassic();
    const classic = upgradeModeInfo(base.manifest, 'classic', true);
    expect(classic.howToPlay).toBe(base.manifest.howToPlay);
    expect(classic.contentLangs).toBe(base.manifest.contentLangs);
    expect(classic.estimate).toBe(base.manifest.estimate);
    expect(classic.minigame).toBe(base.manifest.minigame);
    for (const mode of ['teams', 'tv-vote'] as const)
      expect(upgradeModeInfo(base.manifest, mode, true)).toMatchObject({
        playMode: mode,
        contentLangs: ['en'],
        minPlayers: 2,
        maxPlayers: 8,
        scoreless: false,
        minigame: undefined,
      });
  });

  it('rejects reserved settings, existing roster selectors and excessive envelope size', () => {
    const { game: base } = makeClassic();
    expect(() =>
      createKahootUpgrade({
        ...base,
        manifest: {
          ...base.manifest,
          settings: [
            ...base.manifest.settings,
            {
              key: 'quizRounds',
              label: 'Conflict',
              type: 'number',
              default: 5,
              min: 1,
              max: 5,
              step: 1,
            },
          ],
        },
      }),
    ).toThrow(/conflict/);
    expect(() =>
      createKahootUpgrade({
        ...base,
        manifest: {
          ...base.manifest,
          playerCounts: { setting: 'existing', default: [1, 16], overrides: {} },
        },
      }),
    ).toThrow(/player range/);
    expect(() =>
      createKahootUpgrade({ ...base, manifest: { ...base.manifest, maxInputBytes: 262_144 } }),
    ).toThrow(/hard input cap/);
  });
});
