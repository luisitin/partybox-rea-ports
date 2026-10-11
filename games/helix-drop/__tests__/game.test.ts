import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { game } from '../server/index';
import { botInput } from '../server/bot';
import { scoresOf } from '../server/scoring';
import { kit, freeze } from './helpers';

describe('race lifecycle and views', () => {
  it('begins play immediately with the round clock distinct from the physics beat', () => {
    const s = kit.start();
    expect(s.phase).toEqual({ id: 'play', startedAt: 1000, deadline: 1200 });
    expect(game.tvView(s).deadline).toBe(61_000);
    expect(game.results(s)).toBeNull();
    expect(s.runners.map((r) => [r.floor, r.angle, r.lives])).toEqual([
      [0, 0, 3],
      [0, 0, 3],
    ]);
  });
  it('rearms idle physics, reaches reveal by the cap, then a terminal done', () => {
    const s = kit.timer(kit.start());
    expect(s.phase.deadline).toBe(1400);
    const reveal = kit.until(s, 'reveal', 400);
    expect(reveal.phase.startedAt).toBe(61_000);
    expect(reveal.phase.deadline).toBe(67_500);
    const done = kit.timer(reveal);
    expect(done.phase).toEqual({ id: 'done', startedAt: 67_500, deadline: null });
    expect(game.results(done)?.ranking).toHaveLength(2);
    expect(kit.timer(done)).toBe(done);
  });
  it('only closes early when everybody is finished, not when one remains', () => {
    const s = kit.start();
    const one = { ...s, runners: s.runners.map((r, i) => (i === 0 ? { ...r, lives: 0 } : r)) };
    expect(kit.timer(one).phase.id).toBe('play');
    expect(kit.timer({ ...s, runners: s.runners.map((r) => ({ ...r, lives: 0 })) }).phase.id).toBe(
      'reveal',
    );
  });
  it('input belongs to its player, settles old rotation first, and has an 800ms lease', () => {
    const s = kit.input(freeze(kit.start()), 'a', { type: 'rotate', dir: 1 }, 1100);
    expect(s.runners[0]).toMatchObject({ angle: 0, dir: 1, heldUntil: 900 });
    expect(s.runners[1]?.dir).toBe(0);
    expect(kit.input(s, 'a', { type: 'rotate', dir: 0 }, 1300).runners[0]?.angle).toBe(30);
    expect(kit.input(s, 'a', { type: 'rotate', dir: -1 }, 1000)).toBe(s);
  });
  it('spectators and prototype names cannot steer; stale and early timers are ignored', () => {
    const s = kit.start();
    for (const id of ['ghost', '__proto__', '', 'constructor'])
      expect(kit.input(s, id, { type: 'rotate', dir: 1 }, 1100)).toBe(s);
    expect(game.reduce(s, { type: 'timer', phaseId: 'play', startedAt: 999, now: 5000 })).toBe(s);
    expect(game.reduce(s, { type: 'timer', phaseId: 'wrong', startedAt: 1000, now: 5000 })).toBe(s);
    expect(kit.timer(s, 1100)).toBe(s);
  });
  it('pause freezes movement; resume shifts both clocks and clears old holds', () => {
    const moving = kit.input(kit.start(), 'a', { type: 'rotate', dir: 1 }, 1000);
    const paused = kit.vip(moving, 'pause', 1200);
    expect(paused.checked).toBe(200);
    expect(kit.input(paused, 'a', { type: 'rotate', dir: -1 }, 4000)).toBe(paused);
    expect(kit.timer(paused, 4000)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', 5200);
    expect(resumed).toMatchObject({ began: 5000, endsAt: 65_000, checked: 200 });
    expect(resumed.phase.startedAt).toBe(1000);
    expect(resumed.phase.deadline).toBe(5200);
    expect(resumed.runners[0]?.dir).toBe(0);
    expect(kit.timer(resumed).runners[0]?.angle).toBe(paused.runners[0]?.angle);
    expect(kit.vip(paused, 'end', 61_000).checked).toBe(paused.checked);
    expect(kit.vip(paused, 'skip', 5200).checked).toBe(paused.checked);
  });
  it('disconnect clears steering, ignores new inputs and reconnect preserves progress', () => {
    let s = kit.input(kit.start(), 'a', { type: 'rotate', dir: 1 }, 1000);
    s = { ...s, runners: s.runners.map((r) => ({ ...r, best: 12 })) };
    const dropped = game.reduce(s, { type: 'player', now: 1100, playerId: 'a', connected: false });
    expect(dropped.runners[0]?.dir).toBe(0);
    expect(kit.input(dropped, 'a', { type: 'rotate', dir: 1 }, 1200)).toBe(dropped);
    const back = game.reduce(dropped, {
      type: 'player',
      now: 1200,
      playerId: 'a',
      connected: true,
    });
    expect(game.controllerView(back, 'a').lane?.best).toBe(12);
    expect(kit.until(dropped, 'done', 400).phase.id).toBe('done');
  });
  it('scores deepest completed floors, retains all players and shares ties', () => {
    const s = kit.start();
    const ranked = {
      ...s,
      runners: s.runners.map((r, i) => ({ ...r, best: i ? 9 : 12, floor: 3 })),
    };
    expect(scoresOf(ranked)).toEqual({ a: 12, b: 9 });
    const done = kit.vip(ranked, 'end', 1000);
    expect(game.results(done)?.winnerIds).toEqual(['a']);
    expect(game.results(done)?.ranking.map((r) => [r.playerId, r.rank])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    const tied = kit.vip(
      { ...ranked, runners: ranked.runners.map((r) => ({ ...r, best: 12 })) },
      'end',
      1000,
    );
    expect(game.results(tied)?.winnerIds).toEqual(['a', 'b']);
    expect(game.controllerView(done, 'a').rank).toBe(1);
    expect(game.controllerView(done, 'b').rank).toBe(2);
  });
  it('publishes only visible ring windows, omits leases/PRNG and isolates the personal lane', () => {
    const s = kit.start();
    const tv = game.tvView(s),
      a = game.controllerView(s, 'a'),
      b = game.controllerView(s, 'b');
    expect(tv.lanes).toHaveLength(2);
    expect(tv.lanes.every((l) => l.rings.length === 3)).toBe(true);
    expect(a.lane?.id).toBe('a');
    expect(b.lane?.id).toBe('b');
    expect(a.lanes).toBeUndefined();
    for (const view of [tv, a, b])
      for (const field of ['heldUntil', 'rng', 'respawnAt'])
        expect(JSON.stringify(view)).not.toContain(`"${field}"`);
    expect(JSON.parse(JSON.stringify(tv))).toEqual(tv);
    expect(game.controllerView(s, '__proto__').lane).toBeNull();
    expect(game.controllerView(s, '__proto__').me.role).toBe('spectator');
    expect(game.controllerView({ ...s, phoneOnly: true }, 'a').lanes).toHaveLength(2);
    const remote = { ...s, players: { ...s.players, a: { ...s.players.a!, canSeeTv: false } } };
    expect(game.controllerView(remote, 'a').phoneOnly).toBe(true);
    expect(game.controllerView(remote, 'b').lanes).toBeUndefined();
    expect(tv.winnerIds).toEqual([]);
  });
  it('bots make valid decisions along the shorter arc at all strengths', () => {
    const s = kit.start();
    for (const skill of ['easy', 'normal', 'sharp'] as const)
      expect(game.inputSchema.safeParse(botInput(s, 'a', createRng(12), skill)).success).toBe(true);
    expect(botInput(s, 'a', createRng(12), 'sharp')).toEqual({ type: 'rotate', dir: -1 });
    expect(
      botInput(
        { ...s, runners: s.runners.map((r) => ({ ...r, angle: 300 })) },
        'a',
        createRng(12),
        'sharp',
      ),
    ).toEqual({ type: 'rotate', dir: 0 });
    expect(botInput(s, 'ghost', createRng(12))).toBeNull();
    expect(botInput(kit.vip(s, 'pause', 1000), 'a', createRng(12))).toBeNull();
  });
  it('sharp bots hold a centred opening instead of oscillating by one host beat', () => {
    const s = kit.start();
    const centred = { ...s, tower: s.tower.map((ring, i) => (i ? ring : { ...ring, gap: -15 })) };
    expect(botInput(centred, 'a', createRng(12), 'sharp')).toEqual({ type: 'rotate', dir: 0 });
  });
});
