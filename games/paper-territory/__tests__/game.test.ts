import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { areaScores } from '../server/scoring';
import { PHASES, READY_MS, ROUND_MS, SCORE_MS, TICK_MS } from '../server/types';

const T0 = 1_000_000;
const players = testPlayers(4);
const kit = testKit(game, { t0: T0, players });

describe('Paper Territory lifecycle', () => {
  it('opens a four-second ready stage with every numbered home and no results', () => {
    const state = kit.start();
    expect(PHASES).toEqual(['ready', 'play', 'score', 'done']);
    expect(READY_MS).toBe(4000);
    expect(state.phase).toEqual({ id: 'ready', startedAt: T0, deadline: T0 + READY_MS });
    expect(state.world.runners).toHaveLength(4);
    expect(state.scores).toEqual({ p1: 9, p2: 9, p3: 9, p4: 9 });
    expect(game.results(state)).toBeNull();
    expect(kit.input(state, 'p1', { type: 'direction', dir: 0 })).toBe(state);
  });

  it('runs exactly two minutes in200ms physics beats and reveals the final tile areas', () => {
    const play = kit.timer(kit.start());
    expect(play.phase.id).toBe('play');
    expect(ROUND_MS).toBe(120_000);
    expect(play.endsAt - play.began).toBe(ROUND_MS);
    expect(play.phase.deadline).toBe(play.began + TICK_MS);
    const stepped = kit.timer(play);
    expect(stepped.world.stepped).toBe(1);
    expect(stepped.checked).toBe(TICK_MS);
    expect(stepped.phase.deadline).toBe(play.began + 2 * TICK_MS);
    const score = kit.timer(stepped, stepped.endsAt);
    expect(score.phase.id).toBe('score');
    expect(score.world.stepped).toBe(600);
    expect(score.checked).toBe(ROUND_MS);
    expect(score.scores).toEqual(areaScores(score.world));
    expect(score.phase.deadline).toBe(score.phase.startedAt + SCORE_MS);
    expect(SCORE_MS).toBe(7000);
    const done = kit.timer(score);
    expect(done.phase.id).toBe('done');
    expect(done.phase.deadline).toBeNull();
    expect(game.results(done)?.ranking).toHaveLength(4);
    expect(game.results(done)?.scores).toEqual(score.scores);
    expect(kit.timer(done)).toBe(done);
  });

  it('scores owned tiles, preserves all seat identities, and ranks equal areas together', () => {
    const state = kit.start();
    const world = {
      ...state.world,
      runners: state.world.runners.map((r, index) => ({ ...r, area: [30, 20, 30, 9][index]! })),
    };
    expect(areaScores(world)).toEqual({ p1: 30, p2: 20, p3: 30, p4: 9 });
    const done = {
      ...state,
      world,
      scores: areaScores(world),
      phase: { ...state.phase, id: 'done', deadline: null },
    };
    const results = game.results(done)!;
    expect(results.winnerIds.sort()).toEqual(['p1', 'p3']);
    expect(kit.cv(done, 'p1').rank).toBe(1);
    expect(kit.cv(done, 'p1').tied).toBe(true);
    expect(kit.cv(done, 'p2').rank).toBe(3);
    expect(kit.cv(done, 'p4').rank).toBe(4);
    expect(kit.cv(done, 'spectator').rank).toBeNull();
  });

  it('steering queues before a shared tick and unknown/prototype senders cannot steer', () => {
    const state = kit.timer(kit.start());
    for (const id of ['spectator', '__proto__', 'constructor', ''])
      expect(kit.input(state, id, { type: 'direction', dir: 0 }, state.began + 100)).toBe(state);
    for (const id of ['spectator', '__proto__', 'constructor', ''])
      expect(kit.player(state, id, false, undefined, state.began + 500)).toBe(state);
    const directed = kit.input(state, 'p1', { type: 'direction', dir: 0 }, state.began + 100);
    expect(directed.world.stepped).toBe(0);
    expect(directed.world.runners[0]!.queued).toBe(0);
    expect(directed.world.runners[0]!.cell).toBe(state.world.runners[0]!.cell);
    expect(kit.timer(directed).world.runners[0]!.cell).toBe(
      state.world.runners[0]!.cell - state.world.width,
    );
  });

  it('rejects stale and early phase timers and input before the play instance begins', () => {
    for (const state of [
      kit.start(),
      kit.timer(kit.start()),
      kit.vip(kit.timer(kit.start()), 'skip'),
    ]) {
      expect(kit.timer(state, state.phase.deadline! - 1)).toBe(state);
      expect(
        kit.reduce(state, {
          type: 'timer',
          now: state.phase.deadline! + 1000,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt - 1,
        }),
      ).toBe(state);
    }
    const play = kit.timer(kit.start());
    expect(kit.input(play, 'p1', { type: 'direction', dir: 0 }, play.began - 1)).toBe(play);
  });

  it('VIP skip settles play at the skip moment, then ends after the score beat', () => {
    let state = kit.vip(kit.start(), 'skip', T0 + 1000);
    expect(state.phase.id).toBe('play');
    state = kit.vip(state, 'skip', state.began + 2100);
    expect(state.phase.id).toBe('score');
    expect(state.world.stepped).toBe(10);
    expect(state.scores).toEqual(areaScores(state.world));
    state = kit.vip(state, 'skip', state.phase.startedAt + 1000);
    expect(state.phase.id).toBe('done');
    expect(kit.vip(state, 'skip')).toBe(state);
    expect(kit.vip(kit.start(), 'end').phase.id).toBe('done');
  });

  it('phone-only, remote and spectator views include the public grid without active controls', () => {
    const state = kit.start({ presence: { mode: 'together', phoneOnly: true } });
    expect(kit.tv(state).owners).toEqual(state.world.owners);
    for (const id of [...Object.keys(state.players), 'spectator', '__proto__'])
      expect(kit.cv(state, id).owners).toEqual(state.world.owners);
    const normal = kit.start();
    expect(kit.cv(normal, 'spectator').owners).toEqual(normal.world.owners);
    expect(kit.cv(normal, 'spectator').slot).toBe(-1);
    expect(kit.cv(normal, 'spectator').alive).toBe(false);
    const remote = kit.start({ players: players.map((p) => ({ ...p, canSeeTv: false })) });
    for (const p of players) expect(kit.cv(remote, p.id).owners).toEqual(remote.world.owners);
  });

  it('bots return valid directions at every strength and stay silent in every other phase', () => {
    const ready = kit.start();
    const play = kit.timer(ready);
    const score = kit.vip(play, 'skip');
    const done = kit.timer(score);
    for (const skill of ['easy', 'normal', 'sharp'] as const)
      for (let seed = 1; seed <= 30; seed++) {
        for (const p of players) {
          const input = game.bot.sampleInput(play, p.id, createRng(seed), skill);
          expect(input).not.toBeNull();
          expect(game.inputSchema.safeParse(input).success).toBe(true);
          for (const state of [ready, score, done])
            expect(game.bot.sampleInput(state, p.id, createRng(seed), skill)).toBeNull();
        }
        expect(game.bot.sampleInput(play, 'spectator', createRng(seed), skill)).toBeNull();
      }
  });
});
