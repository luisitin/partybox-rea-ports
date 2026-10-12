import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { scoresOf } from '../server/scoring';
import { REVEAL_MS, ROUND_MS, TICK_MS } from '../server/types';
import { freeze, hole, move, prop, start, timer, T0, vip, world } from './helpers';

describe('a ninety-second round', () => {
  it('starts directly in play, exposes the round clock, and rearms its engine beats', () => {
    const s = start(8);
    expect(s.phase).toEqual({ id: 'play', startedAt: T0, deadline: T0 + TICK_MS });
    expect(s.endsAt - s.began).toBe(90_000);
    expect(s.world.holes).toHaveLength(8);
    expect(game.tvView(s).deadline).toBe(T0 + ROUND_MS);
    expect(game.controllerView(s, 'p1').deadline).toBe(T0 + ROUND_MS);
    const next = timer(s);
    expect(next.phase.startedAt).toBe(T0);
    expect(next.phase.deadline).toBe(T0 + TICK_MS * 2);
    expect(next.world.elapsed).toBe(TICK_MS);
    expect(game.results(next)).toBeNull();
  });
  it('ends exactly at ninety seconds, reveals for seven seconds, then returns complete results', () => {
    const almost = timer(start(8), T0 + 89_999);
    expect(almost.phase.id).toBe('play');
    expect(almost.phase.deadline).toBe(T0 + 90_000);
    const reveal = timer(almost, T0 + 90_000);
    expect(reveal.world.elapsed).toBe(90_000);
    expect(reveal.phase).toEqual({ id: 'reveal', startedAt: T0 + 90_000, deadline: T0 + 97_000 });
    expect(REVEAL_MS).toBe(7000);
    expect(game.results(reveal)).toBeNull();
    expect(timer(reveal, T0 + 96_999)).toBe(reveal);
    const done = timer(reveal);
    expect(done.phase).toEqual({ id: 'done', startedAt: T0 + 97_000, deadline: null });
    expect(Object.keys(game.results(done)!.scores)).toHaveLength(8);
    expect(game.results(done)!.winnerIds).toHaveLength(8);
    expect(timer(done, T0 + 1_000_000)).toBe(done);
    expect(move(done, 'p1', 1, 0, T0 + 1_000_000)).toBe(done);
  });
  it('ignores timers with a stale instance, wrong phase, and an early timestamp', () => {
    for (const s of [start(), timer(start(), T0 + ROUND_MS)]) {
      const live = {
        type: 'timer' as const,
        now: s.phase.deadline!,
        phaseId: s.phase.id,
        startedAt: s.phase.startedAt,
      };
      expect(game.reduce(s, { ...live, startedAt: live.startedAt - 1 })).toBe(s);
      expect(game.reduce(s, { ...live, phaseId: 'no-such-phase' })).toBe(s);
      expect(game.reduce(s, { ...live, now: live.now - 1 })).toBe(s);
    }
  });
  it('credits elapsed intake before skip and end, and freezes the reveal city', () => {
    const s = { ...start(), world: world([hole(), hole('p2', { slot: 1, x: 120 })], [prop()]) };
    const reveal = vip(s, 'skip', T0 + 100);
    expect(reveal.phase.id).toBe('reveal');
    expect(reveal.scores).toEqual({ p1: 2, p2: 0 });
    expect(move(reveal, 'p1', 1, 1, T0 + 200)).toBe(reveal);
    const done = vip(reveal, 'skip', T0 + 300);
    expect(game.results(done)!.scores).toEqual({ p1: 2, p2: 0 });
    const ended = vip(s, 'end', T0 + 100);
    expect(ended.phase.id).toBe('done');
    expect(game.results(ended)!.scores).toEqual({ p1: 2, p2: 0 });
  });
  it('uses accumulated intake rather than current mass and gives true ties equal ranks', () => {
    const base = start(3);
    const custom = {
      ...base,
      world: world([
        hole('p1', { score: 40, mass: 0 }),
        hole('p2', { slot: 1, score: 40, mass: 40, x: 100 }),
        hole('p3', { slot: 2, score: 10, mass: 500, x: 140 }),
      ]),
    };
    const done = vip(custom, 'end', T0);
    const result = game.results(done)!;
    expect(result.scores).toEqual({ p1: 40, p2: 40, p3: 10 });
    expect(result.winnerIds.sort()).toEqual(['p1', 'p2']);
    expect(result.ranking.filter((row) => row.rank === 1)).toHaveLength(2);
    expect(game.controllerView(done, 'p1').rank).toBe(1);
    expect(game.controllerView(done, 'p2').rank).toBe(1);
    expect(game.controllerView(done, 'p3').rank).toBe(3);
  });
});

describe('holds, identity, and connectivity', () => {
  it('holds simulation and inputs while paused, then shifts every absolute clock exactly once', () => {
    const initial = {
      ...start(),
      world: world([hole('p1', { dx: 1 }), hole('p2', { slot: 1, x: 120 })]),
    };
    const paused = vip(initial, 'pause', T0 + 300);
    expect(paused.world.elapsed).toBe(300);
    expect(paused.world.holes[0]!.dx).toBe(0);
    expect(move(paused, 'p1', 1, 0, T0 + 9000)).toBe(paused);
    expect(timer(paused, T0 + 9000)).toBe(paused);
    expect(vip(paused, 'pause', T0 + 9000)).toBe(paused);
    const resumed = vip(paused, 'resume', T0 + 10_300);
    expect(resumed.began).toBe(T0 + 10_000);
    expect(resumed.endsAt).toBe(T0 + 100_000);
    expect(resumed.phase.startedAt).toBe(T0);
    expect(resumed.phase.deadline).toBe(initial.phase.deadline! + 10_000);
    expect(resumed.world).toBe(paused.world);
    expect(resumed.phase.paused).toBeUndefined();
    expect(vip(resumed, 'resume', T0 + 20_000)).toBe(resumed);
    expect(timer(resumed, T0 + 99_999).phase.id).toBe('play');
    expect(timer(resumed, T0 + 100_000).phase.id).toBe('reveal');
  });
  it('skipping or ending a hold never credits the paused duration as play', () => {
    const initial = {
      ...start(),
      world: world([hole('p1', { dx: 1 }), hole('p2', { slot: 1, x: 120 })]),
    };
    const paused = vip(initial, 'pause', T0 + 200);
    const skipped = vip(paused, 'skip', T0 + 10_200);
    expect(skipped.phase.id).toBe('reveal');
    expect(skipped.world.elapsed).toBe(200);
    expect(skipped.world.holes[0]!.x).toBe(paused.world.holes[0]!.x);
    expect(vip(paused, 'end', T0 + 10_200).world).toEqual(paused.world);
  });
  it.each(['ghost', '', '__proto__', 'constructor', 'toString'])(
    'ignores all actions from unknown identity %s',
    (id) => {
      const s = start();
      expect(move(s, id, 1, 1, T0 + 1000)).toBe(s);
      expect(
        game.reduce(s, { type: 'player', now: T0 + 1000, playerId: id, connected: false }),
      ).toBe(s);
      expect(game.controllerView(s, id).me.role).toBe('spectator');
      expect(game.controllerView(s, id).mine).toBeNull();
      expect(game.bot.sampleInput(s, id, { int: () => 0 } as never)).toBeNull();
    },
  );
  it('supports a real player named __proto__ as an own roster key', () => {
    const s = game.init({
      players: [
        { id: '__proto__', name: 'Proto', avatarId: 'fox', connected: true },
        { id: 'other', name: 'Other', avatarId: 'owl', connected: true },
      ],
      now: T0,
      seed: 7,
      settings: {},
    });
    expect(Object.hasOwn(s.players, '__proto__')).toBe(true);
    expect(game.controllerView(s, '__proto__').me.role).toBe('player');
    expect(move(s, '__proto__', 1, 0).world.holes.find((h) => h.id === '__proto__')!.dx).toBe(1);
    expect(game.results(vip(s, 'end', T0))!.scores['__proto__']).toBe(0);
  });
  it('settles and stops a disconnected hole, blocks its inputs, and reconnects without losing score', () => {
    const initial = {
      ...start(),
      world: world([hole('p1', { dx: 1, score: 37 }), hole('p2', { slot: 1, x: 120 })]),
    };
    const dropped = game.reduce(initial, {
      type: 'player',
      now: T0 + 500,
      playerId: 'p1',
      connected: false,
    });
    expect(dropped.world.holes[0]!.x).toBeCloseTo(59.5);
    expect(dropped.world.holes[0]!.dx).toBe(0);
    expect(move(dropped, 'p1', 1, 0, T0 + 1000)).toBe(dropped);
    const restored = game.reduce(dropped, {
      type: 'player',
      now: T0 + 5000,
      playerId: 'p1',
      connected: true,
    });
    expect(restored.world.holes[0]!.x).toBe(dropped.world.holes[0]!.x);
    expect(restored.world.holes[0]!.score).toBe(37);
    expect(move(restored, 'p1', -1, 0, T0 + 5000).world.holes[0]!.dx).toBe(-1);
    const allGone = game.reduce(dropped, {
      type: 'player',
      now: T0 + 1000,
      playerId: 'p2',
      connected: false,
      gone: 'left',
    });
    expect(game.results(timer(timer(allGone, T0 + ROUND_MS)))!.scores).toEqual({ p1: 37, p2: 0 });
  });
  it('never mutates frozen input states, rejects earlier movement, and keeps scoring serializable', () => {
    const s = freeze(start());
    const snapshot = JSON.stringify(s);
    const moved = move(s, 'p1', 0.6, 0.8, T0 + 300);
    expect(move(moved, 'p1', -1, 0, T0 + 200)).toBe(moved);
    const paused = vip(s, 'pause', T0 + 1000);
    const ended = vip(s, 'end', T0 + 1000);
    expect(JSON.stringify(s)).toBe(snapshot);
    for (const next of [moved, paused, ended]) {
      expect(JSON.parse(JSON.stringify(next))).toEqual(next);
      expect(next.scores).toEqual(scoresOf(next.world));
    }
  });
});
