// Pin the race rules and their boundary cases independently of the SDK's generic checks.
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { kit, miss, startPlay, tap, unsafeTap } from './helpers';

describe('race input and scoring', () => {
  it('a correct current-row tile earns exactly one point and advances exactly one row', () => {
    const before = startPlay();
    const after = tap(before);
    expect(after.runs.p1?.tiles).toBe(1);
    expect(after.runs.p1?.lastAt).toBe(before.began + 100);
    expect(after.runs.p2).toEqual(before.runs.p2);
    expect(after.sequence).toEqual(before.sequence);
    expect(after.rng).toEqual(before.rng);
  });

  it('a wrong current-row column ends only that player and freezes the earned count', () => {
    const first = tap(startPlay());
    const after = miss(first);
    expect(after.phase.id).toBe('play');
    expect(after.runs.p1).toMatchObject({ tiles: 1, out: true });
    expect(after.runs.p1?.wrongColumn).toBe(((first.sequence[1] ?? 0) + 1) % 4);
    expect(after.runs.p2).toEqual(first.runs.p2);
    expect(tap(after, 'p1', after.began + 500).runs.p1).toEqual(after.runs.p1);
  });

  it('replayed and future rows cannot score or eliminate a player', () => {
    const state = tap(startPlay());
    for (const row of [0, 2, 999_999]) {
      const input = { type: 'tap' as const, column: ((state.sequence[1] ?? 0) + 1) % 4, row };
      const after = kit.input(state, 'p1', input, state.began + 300);
      expect(after.runs).toEqual(state.runs);
      expect(after.phase.id).toBe('play');
    }
    expect(tap(state, 'p1', state.began + 400).runs.p1?.tiles).toBe(2);
  });

  it('strangers, disconnected players and prototype names cannot change any run', () => {
    const state = kit.player(startPlay(), 'p1', false);
    for (const id of ['p1', 'spectator', '', '__proto__', 'constructor', 'toString']) {
      const after = tap(state, id, state.began + 600);
      expect(after.runs).toEqual(state.runs);
    }
  });

  it('schema rejects negative, fractional, missing and nonfinite positions', () => {
    for (const column of [-1, 4, 0.5, NaN, Infinity, '1', null, undefined])
      expect(game.inputSchema.safeParse(unsafeTap(column, 0)).success).toBe(false);
    for (const row of [-1, 0.5, NaN, Infinity, '0', null, undefined])
      expect(game.inputSchema.safeParse(unsafeTap(0, row)).success).toBe(false);
    expect(game.inputSchema.safeParse({ type: 'tap', column: 3, row: 1024 }).success).toBe(true);
  });

  it('invalid injected input is total and cannot earn points or eliminate anyone', () => {
    const state = startPlay();
    for (const input of [unsafeTap(-1, 0), unsafeTap(4, 0), unsafeTap(0, -1), unsafeTap(0, NaN)]) {
      const after = kit.input(state, 'p1', input);
      expect(after.runs).toEqual(state.runs);
    }
  });

  it('ready, score and done accept no race taps', () => {
    let state = kit.start();
    expect(tap(state).runs).toEqual(state.runs);
    state = kit.vip(kit.timer(state), 'skip');
    expect(state.phase.id).toBe('score');
    expect(tap(state).runs).toEqual(state.runs);
    state = kit.timer(state);
    expect(state.phase.id).toBe('done');
    expect(tap(state).runs).toEqual(state.runs);
    expect(kit.vip(state, 'skip').phase.id).toBe('done');
  });

  it('a depleted sequence has no undefined scoring target', () => {
    const before = startPlay();
    const state = { ...before, runs: { ...before.runs, p1: { ...before.runs.p1!, tiles: 1024 } } };
    const after = kit.input(state, 'p1', { type: 'tap', column: 0, row: 1024 });
    expect(after.runs.p1?.tiles).toBe(1024);
    expect(JSON.parse(JSON.stringify(after))).toEqual(after);
  });

  it('extends the common seeded track before the lookahead is exhausted', () => {
    const before = startPlay();
    const state = {
      ...before,
      runs: { ...before.runs, p1: { ...before.runs.p1!, tiles: 1020 } },
    };
    const after = tap(state);
    expect(after.runs.p1?.tiles).toBe(1021);
    expect(after.sequence.length).toBeGreaterThan(before.sequence.length);
    expect(after.sequence.slice(0, 1024)).toEqual(before.sequence);
    expect(after.rng.step).toBeGreaterThan(before.rng.step);
    expect(game.controllerView(after, 'p1').notes).toHaveLength(4);
    expect(tap(state)).toEqual(after);
    const other = { ...after, runs: { ...after.runs, p2: { ...after.runs.p2!, tiles: 1021 } } };
    expect(game.controllerView(other, 'p2').notes).toEqual(game.controllerView(after, 'p1').notes);
  });

  it('completed scores are tile counts with tied ranks and no survival or speed bonus', () => {
    let state = startPlay();
    state = tap(state, 'p1');
    state = tap(state, 'p2');
    state = tap(state, 'p3');
    state = tap(state, 'p3', state.began + 300);
    state = miss(state, 'p1', state.began + 400);
    state = kit.timer(state, state.endsAt);
    expect(state.phase.id).toBe('score');
    expect(game.results(state)).toBeNull();
    state = kit.timer(state);
    const results = game.results(state)!;
    expect(results.scores).toEqual({ p1: 1, p2: 1, p3: 2 });
    expect(results.winnerIds).toEqual(['p3']);
    expect(results.ranking.find((r) => r.playerId === 'p1')?.rank).toBe(2);
    expect(results.ranking.find((r) => r.playerId === 'p2')?.rank).toBe(2);
  });
});

describe('shared clock and phase exits', () => {
  it('runs a 3 second ready beat, a 30 second race and a 6 second score beat', () => {
    let state = kit.start();
    expect(state.phase.deadline! - state.phase.startedAt).toBe(3000);
    state = kit.timer(state);
    expect(state.phase.id).toBe('play');
    expect(state.endsAt - state.began).toBe(30_000);
    state = kit.timer(state, state.endsAt);
    expect(state.phase.id).toBe('score');
    expect(state.phase.deadline! - state.phase.startedAt).toBe(6000);
    state = kit.timer(state);
    expect(state.phase.id).toBe('done');
    expect(state.phase.deadline).toBeNull();
    expect(game.results(state)).not.toBeNull();
  });

  it('early and stale timers never exit a phase', () => {
    for (const state of [kit.start(), startPlay(), kit.vip(startPlay(), 'skip')]) {
      const early = kit.timer(state, state.phase.startedAt + 1);
      expect(early.phase.id).toBe(state.phase.id);
      const stale = kit.reduce(state, {
        type: 'timer',
        now: state.endsAt + 100_000,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt - 1,
      });
      expect(stale).toEqual(state);
    }
  });

  it('a last-millisecond tap scores, a tap on or after the deadline does not', () => {
    const state = startPlay();
    expect(tap(state, 'p1', state.endsAt - 1).runs.p1?.tiles).toBe(1);
    for (const now of [state.endsAt, state.endsAt + 1, state.endsAt + 100_000]) {
      const after = tap(state, 'p1', now);
      expect(after.phase.id).toBe('score');
      expect(after.runs.p1?.tiles).toBe(0);
      expect(after.elapsed).toBe(30_000);
    }
  });

  it('a lone surviving racer keeps playing and the last wrong tap closes the race', () => {
    let state = miss(startPlay(), 'p1');
    state = miss(state, 'p2', state.began + 300);
    expect(state.phase.id).toBe('play');
    state = tap(state, 'p3', state.began + 400);
    expect(state.runs.p3?.tiles).toBe(1);
    state = miss(state, 'p3', state.began + 500);
    expect(state.phase.id).toBe('score');
    expect(state.elapsed).toBe(500);
  });

  it('disconnect preserves progress, reconnect restores it and absence never blocks the clock', () => {
    let state = tap(startPlay());
    const run = state.runs.p1;
    state = kit.player(state, 'p1', false, undefined, state.began + 200);
    expect(state.runs.p1).toEqual(run);
    expect(state.players.p1?.connected).toBe(false);
    state = kit.player(state, 'p1', true, undefined, state.began + 500);
    expect(state.runs.p1).toEqual(run);
    state = tap(state, 'p1', state.began + 600);
    expect(state.runs.p1?.tiles).toBe(2);
    for (const id of Object.keys(state.players)) state = kit.player(state, id, false);
    state = kit.timer(state, state.endsAt);
    expect(state.phase.id).toBe('score');
    state = kit.timer(state);
    expect(game.results(state)?.scores.p1).toBe(2);
  });

  it('an absent living run does not trigger all-out completion', () => {
    let state = kit.player(startPlay(), 'p3', false);
    state = miss(state, 'p1');
    state = miss(state, 'p2');
    expect(state.phase.id).toBe('play');
    expect(kit.timer(state, state.endsAt).phase.id).toBe('score');
  });

  it('pause holds input and timers; resume shifts both race clocks and bot cadence', () => {
    let state = tap(startPlay());
    const before = state;
    const pausedAt = state.began + 500;
    state = kit.vip(state, 'pause', pausedAt);
    expect(state.phase.paused).toBeTruthy();
    expect(state.elapsed).toBe(500);
    expect(tap(state, 'p1', pausedAt + 1000)).toEqual(state);
    expect(kit.timer(state, state.endsAt + 100_000)).toEqual(state);
    state = kit.vip(state, 'resume', pausedAt + 5000);
    expect(state.phase.paused).toBeFalsy();
    expect(state.began).toBe(before.began + 5000);
    expect(state.endsAt).toBe(before.endsAt + 5000);
    expect(state.runs.p1?.lastAt).toBe(before.runs.p1!.lastAt! + 5000);
    expect(state.runs.p2?.lastAt).toBeNull();
    expect(tap(state, 'p1', state.endsAt - 1).runs.p1?.tiles).toBe(2);
  });

  it('VIP skip locks the current count and VIP end creates complete results', () => {
    const state = tap(startPlay());
    const score = kit.vip(state, 'skip', state.began + 300);
    expect(score.phase.id).toBe('score');
    expect(score.runs.p1?.tiles).toBe(1);
    const done = kit.vip(state, 'end', state.began + 400);
    expect(done.phase.id).toBe('done');
    expect(game.results(done)?.scores).toEqual({ p1: 1, p2: 0, p3: 0 });
  });

  it('ending a paused race freezes at the pause point, not the later wall clock', () => {
    let state = tap(startPlay());
    state = kit.vip(state, 'pause', state.began + 750);
    const ended = kit.vip(state, 'end', state.began + 100_000);
    expect(ended.phase.id).toBe('done');
    expect(ended.elapsed).toBe(750);
    expect(game.results(ended)?.scores).toEqual({ p1: 1, p2: 0, p3: 0 });
  });
});

describe('seeded course and bots', () => {
  it('the course is bounded, varied and identical for the same seed at every player count', () => {
    const first = kit.start({ seed: 812 });
    expect(first.sequence).toHaveLength(1024);
    expect(new Set(first.sequence)).toEqual(new Set([0, 1, 2, 3]));
    for (const n of [2, 4, 8])
      expect(kit.start({ seed: 812, players: testPlayers(n) }).sequence).toEqual(first.sequence);
    expect(kit.start({ seed: 813 }).sequence).not.toEqual(first.sequence);
    expect(first.rng.step).toBeGreaterThan(0);
  });

  it('bots act only in play for living connected racers, with valid current-row inputs', () => {
    const rng = createRng(190);
    expect(game.bot.sampleInput(kit.start(), 'p1', rng)).toBeNull();
    const before = startPlay();
    const state = { ...before, elapsed: 1000 };
    let sampled = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const input = game.bot.sampleInput(state, 'p1', createRng(seed));
      if (input) {
        sampled++;
        expect(game.inputSchema.safeParse(input).success).toBe(true);
        expect(input.row).toBe(0);
      }
    }
    expect(sampled).toBe(50);
    expect(game.bot.sampleInput(state, 'spectator', rng)).toBeNull();
    expect(game.bot.sampleInput(miss(state), 'p1', rng)).toBeNull();
    expect(game.bot.sampleInput(kit.player(state, 'p1', false), 'p1', rng)).toBeNull();
    expect(game.bot.sampleInput(kit.vip(state, 'pause'), 'p1', rng)).toBeNull();
  });

  it('the three strengths differ in cadence and a supplied strength overrides the room default', () => {
    const state = { ...startPlay(), elapsed: 200, botSkill: 'easy' as const };
    expect(game.bot.sampleInput(state, 'p1', createRng(1))).toBeNull();
    expect(game.bot.sampleInput(state, 'p1', createRng(1), 'normal')).toBeNull();
    expect(game.bot.sampleInput(state, 'p1', createRng(1), 'sharp')).not.toBeNull();
    expect(
      game.bot.sampleInput({ ...state, elapsed: 350 }, 'p1', createRng(1), 'normal'),
    ).not.toBeNull();
    expect(
      game.bot.sampleInput({ ...state, elapsed: 620 }, 'p1', createRng(1), 'easy'),
    ).not.toBeNull();
  });
});
