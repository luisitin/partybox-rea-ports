import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent, Settings } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { makeClassic } from '../__tests__/upgrade-fixture';
import type { ClassicInput } from '../__tests__/upgrade-fixture';
import { game as quiz } from './index';
import type { Input, State } from './types';
import { createKahootUpgrade } from './upgrade';
import type { QuizUpgradeMode, UpgradeInput } from './upgrade';

describe('selected team/vote state remains identical to the public reducer', () => {
  for (const mode of ['teams', 'tv-vote'] as const) {
    for (const n of [2, 4, 8]) {
      it(`${mode}, ${n} players, three seeds through every phase and terminal results`, () => {
        for (const seed of [1, 2, 3]) {
          const { game: base } = makeClassic();
          const game = createKahootUpgrade(base);
          const settings: Settings = {
            mode,
            pack: 'general',
            rounds: 5,
            seconds: 10,
            teamCount: 4,
            talkSeconds: 5,
          };
          const ctx = { players: testPlayers(n, { bots: n }), settings, seed, now: 1_000 };
          let direct = quiz.init(ctx);
          let wrapped = game.init({
            ...ctx,
            settings: {
              playMode: mode,
              quizPack: 'general',
              quizRounds: 5,
              quizSeconds: 10,
              quizTeamCount: 4,
              quizTalkSeconds: 5,
              answerSeconds: 30,
              questions: 20,
            },
          });
          const rng = createRng(seed + 100);
          const seen = new Set<string>();
          let steps = 0;
          const deliver = (event: GameEvent<Input>): void => {
            direct = quiz.reduce(direct, event);
            const wrappedEvent: GameEvent<UpgradeInput<ClassicInput>> =
              event.type === 'input'
                ? { ...event, input: { type: 'mode-input', playMode: mode, input: event.input } }
                : event;
            wrapped = game.reduce(wrapped, wrappedEvent);
            seen.add(direct.phase.id);
          };
          while (steps++ < 500 && direct.phase.id !== 'done') {
            expect(wrapped.selected).toEqual(direct);
            expect(wrapped.phase).toBe(wrapped.selected.phase);
            expect(wrapped.rng).toBe(wrapped.selected.rng);
            expect(wrapped.players).toBe(wrapped.selected.players);
            seen.add(direct.phase.id);
            const canonical = { gameId: base.manifest.id, playMode: mode };
            expect(game.tvView(wrapped)).toEqual({ ...quiz.tvView(direct), ...canonical });
            for (const id of ['p1', 'p2', 'spectator'])
              expect(game.controllerView(wrapped, id)).toEqual({
                ...quiz.controllerView(direct, id),
                ...canonical,
              });
            if (direct.phase.id === 'question') {
              for (const player of ctx.players) {
                if (direct.phase.id !== 'question') break;
                const botSeed = rng.int(1, 1_000_000);
                const directRng = createRng(botSeed);
                const wrappedRng = createRng(botSeed);
                const sampled = quiz.bot.sampleInput(direct, player.id, directRng, 'sharp');
                expect(game.bot.sampleInput(wrapped, player.id, wrappedRng, 'sharp')).toEqual(
                  sampled === null ? null : { type: 'mode-input', playMode: mode, input: sampled },
                );
                expect(wrappedRng.state()).toEqual(directRng.state());
                const input = sampled ?? {
                  type: 'answer',
                  round: direct.round,
                  choice: player.id === 'p1' ? direct.deck[direct.round - 1]!.correct : 0,
                };
                deliver({
                  type: 'input',
                  now: direct.openedAt + 1_000,
                  playerId: player.id,
                  input,
                });
              }
            }
            if (direct.phase.id !== 'done')
              deliver({
                type: 'timer',
                now: direct.phase.deadline!,
                phaseId: direct.phase.id,
                startedAt: direct.phase.startedAt,
              });
          }
          expect(steps).toBeLessThan(500);
          expect(wrapped.selected).toEqual(direct);
          expect(direct.phase.id).toBe('done');
          expect([...seen]).toEqual(
            expect.arrayContaining(['talk', 'question', 'reveal', 'score', 'podium']),
          );
          expect(game.results(wrapped)).toEqual(quiz.results(direct));
          expect(game.results(wrapped)?.ranking).toHaveLength(n);
        }
      });
    }
  }

  it('maps the selected language/settings only once and rejects cross-mode/stale callbacks', () => {
    const game = createKahootUpgrade(makeClassic().game);
    for (const mode of ['teams', 'tv-vote'] as QuizUpgradeMode[]) {
      let state = game.init({
        players: testPlayers(4),
        settings: { playMode: mode, quizRounds: 5 },
        contentLang: 'es',
        seed: 2,
        now: 1_000,
      });
      expect((state.selected as State).settings.mode).toBe(mode);
      expect(state.phase.id).toBe('talk');
      const answer = { type: 'answer' as const, round: 1, choice: 0 };
      const wrongMode = mode === 'teams' ? 'tv-vote' : 'teams';
      expect(
        game.reduce(state, {
          type: 'input',
          now: 1_010,
          playerId: 'p1',
          input: { type: 'mode-input', playMode: wrongMode, input: answer },
        }),
      ).toBe(state);
      expect(
        game.reduce(state, {
          type: 'input',
          now: 1_010,
          playerId: 'p1',
          input: { type: 'mode-input', playMode: mode, input: answer },
        }),
      ).toBe(state);
      state = game.reduce(state, {
        type: 'timer',
        now: state.phase.deadline!,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      expect(state.phase.id).toBe('question');
      expect(
        game.reduce(state, {
          type: 'input',
          now: state.phase.startedAt + 1,
          playerId: 'p1',
          input: { type: 'mode-input', playMode: mode, input: { ...answer, round: 20 } },
        }),
      ).toBe(state);
      const view = game.tvView(state);
      expect(view).not.toHaveProperty('selected');
      if (view.playMode === 'classic') throw new Error('Expected the selected quiz view');
      expect(view.reveal).toBeNull();
      expect(game.controllerView(state, 'p1')).not.toHaveProperty('deck');
    }
  });

  it('delegates pause/resume, departure and VIP actions with exact mirrored timer fields', () => {
    const game = createKahootUpgrade(makeClassic().game);
    let state = game.init({
      players: testPlayers(4),
      settings: { playMode: 'teams', quizRounds: 5 },
      seed: 3,
      now: 1_000,
    });
    state = game.reduce(state, {
      type: 'timer',
      now: state.phase.deadline!,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
    const before = state.selected as State;
    state = game.reduce(state, { type: 'vip', action: 'pause', now: before.openedAt + 1_000 });
    const paused = state;
    expect(state.phase).toBe(state.selected.phase);
    expect(state.phase.paused).toEqual({ at: before.openedAt + 1_000 });
    expect(
      game.reduce(state, {
        type: 'input',
        now: before.openedAt + 2_000,
        playerId: 'p1',
        input: {
          type: 'mode-input',
          playMode: 'teams',
          input: { type: 'answer', round: 1, choice: 0 },
        },
      }),
    ).toBe(paused);
    state = game.reduce(state, { type: 'vip', action: 'resume', now: before.openedAt + 6_000 });
    expect(state.phase.deadline).toBe(before.phase.deadline! + 5_000);
    expect((state.selected as State).openedAt).toBe(before.openedAt + 5_000);
    state = game.reduce(state, {
      type: 'player',
      playerId: 'p2',
      connected: false,
      now: before.openedAt + 6_100,
    });
    expect(state.players).toBe(state.selected.players);
    expect(state.players.p2?.connected).toBe(false);
    state = game.reduce(state, { type: 'vip', action: 'end', now: before.openedAt + 6_200 });
    expect(state.phase.id).toBe('done');
    expect(game.results(state)?.ranking).toHaveLength(4);
  });
});
