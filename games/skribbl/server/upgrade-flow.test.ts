import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game as live } from './index';
import type { Input } from './types';
import { upgradeFixture as fixture } from '../__tests__/upgrade-helpers';
describe('upgraded game clock and complete flow', () => {
  it.each(['telephone', 'live-guessing'] as const)(
    'keeps %s pause/resume clocks in the selected reducer',
    (playMode) => {
      const { ctx, upgrade } = fixture();
      let state = upgrade.init({ ...ctx, settings: { playMode } });
      if (state.playMode === 'live-guessing')
        state = upgrade.reduce(state, {
          type: 'input',
          now: ctx.now + 1,
          playerId: state.selected.drawer,
          input: {
            type: 'mode-input',
            playMode: 'live-guessing',
            input: { type: 'choose', index: 0 },
          },
        });
      const deadline = state.phase.deadline!;
      const before = JSON.stringify(state);
      const paused = upgrade.reduce(state, { type: 'vip', now: ctx.now + 10, action: 'pause' });
      expect(JSON.stringify(state)).toBe(before);
      expect(paused.phase).toBe(paused.selected.phase);
      expect(paused.phase.paused?.at).toBe(ctx.now + 10);
      const resumed = upgrade.reduce(paused, {
        type: 'vip',
        now: ctx.now + 1_010,
        action: 'resume',
      });
      expect(resumed.phase).toBe(resumed.selected.phase);
      expect(resumed.phase.deadline).toBe(deadline + 1_000);
      expect(resumed.phase.paused).toBeUndefined();
      if (state.playMode === 'live-guessing' && resumed.playMode === 'live-guessing')
        expect(resumed.selected.endsAt).toBe(state.selected.endsAt + 1_000);
    },
  );

  it.each([2, 4, 8])(
    'matches direct live games to completion with %i players at seeds 1, 2 and 3',
    (count) => {
      const { ctx, upgrade } = fixture();
      for (const seed of [1, 2, 3]) {
        const players = testPlayers(count, { bots: count });
        const original = {
          ...ctx,
          seed,
          players,
          settings: { laps: 1, drawSeconds: 30, difficulty: 'easy' },
        };
        let direct = live.init(original);
        let wrapped = upgrade.init({
          ...original,
          settings: {
            playMode: 'live-guessing',
            liveLaps: 1,
            liveDrawSeconds: 30,
            liveDifficulty: 'easy',
          },
        });
        let now = ctx.now;
        let ticks = 0;
        const rng = createRng(seed ^ 0x504);
        const deliver = (event: GameEvent<Input>): void => {
          direct = live.reduce(direct, event);
          wrapped = upgrade.reduce(
            wrapped,
            event.type === 'input'
              ? {
                  ...event,
                  input: { type: 'mode-input', playMode: 'live-guessing', input: event.input },
                }
              : event,
          );
          expect(wrapped.selected).toEqual(direct);
          expect(wrapped.phase).toBe(wrapped.selected.phase);
          expect(wrapped.rng).toBe(wrapped.selected.rng);
          expect(wrapped.players).toBe(wrapped.selected.players);
        };
        while (direct.phase.id !== 'done' && ticks++ < 1_000) {
          now += 1_000;
          if (direct.phase.deadline !== null && now >= direct.phase.deadline)
            deliver({
              type: 'timer',
              now,
              phaseId: direct.phase.id,
              startedAt: direct.phase.startedAt,
            });
          for (const player of rng.shuffle(players)) {
            const botSeed = rng.int(1, 1_000_000);
            const expected = live.bot.sampleInput(direct, player.id, createRng(botSeed), 'sharp');
            const actual = upgrade.bot.sampleInput(wrapped, player.id, createRng(botSeed), 'sharp');
            expect(actual?.input ?? null).toEqual(expected);
            if (expected) deliver({ type: 'input', now, playerId: player.id, input: expected });
          }
        }
        expect(direct.phase.id).toBe('done');
        expect(upgrade.results(wrapped)).toEqual(live.results(direct));
        const actualView = upgrade.tvView(wrapped);
        const directView = live.tvView(direct);
        expect({ ...actualView, gameId: directView.gameId }).toEqual({
          ...directView,
          playMode: 'live-guessing',
        });
      }
    },
  );
});
