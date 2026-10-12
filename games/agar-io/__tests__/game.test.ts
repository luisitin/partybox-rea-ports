import { createRng } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { radius } from '../server/geometry';
import { ROUND_MS, SCORE_MS, STEP_MS, WAKE_MS } from '../server/types';
import { cell, deepFreeze, kit, T0, world } from './helpers';

describe('the three-round match', () => {
  it('starts playing immediately after the shell start, with a 90-second clock', () => {
    const s = kit.start();
    expect(s.phase).toEqual({ id: 'play', startedAt: T0, deadline: T0 + WAKE_MS });
    expect(s.began).toBe(T0);
    expect(s.endsAt).toBe(T0 + ROUND_MS);
    expect(s.round).toBe(1);
    expect(s.world.cells).toHaveLength(3);
    expect(game.results(s)).toBeNull();
    expect(game.tvView(s).deadline).toBe(s.endsAt);
  });

  it('re-arms its short wake timer while the public countdown still ends at the horn', () => {
    const start = kit.start();
    const s = kit.timer(start);
    expect(s.phase.id).toBe('play');
    expect(s.phase.startedAt).toBe(start.phase.startedAt);
    expect(s.phase.deadline).toBe(T0 + WAKE_MS * 2);
    expect(s.world.time).toBe(WAKE_MS);
    expect(game.controllerView(s, 'p1').deadline).toBe(T0 + ROUND_MS);
  });

  it('settles the last physics step at the horn and scores current mass once', () => {
    const start = {
      ...kit.start(),
      world: world([cell('p1', { mass: 60.7 }), cell('p2', { id: 2, x: 110, mass: 24 })], {
        time: ROUND_MS - STEP_MS,
        pellets: [{ id: 0, x: 60, y: 50 }],
      }),
    };
    const ended = kit.timer(start, start.endsAt);
    expect(ended.phase.id).toBe('score');
    expect(ended.world.time).toBe(ROUND_MS);
    expect(ended.lastPoints).toEqual({ p1: 63, p2: 24, p3: 0 });
    expect(ended.scores).toEqual(ended.lastPoints);
    expect(ended.phase.deadline).toBe(start.endsAt + SCORE_MS);
    const stale = kit.reduce(ended, {
      type: 'timer',
      now: start.endsAt,
      phaseId: start.phase.id,
      startedAt: start.phase.startedAt,
    });
    expect(stale).toBe(ended);
    const after = kit.input(ended, 'p1', { type: 'split' }, start.endsAt + 1000);
    expect(after.world).toBe(ended.world);
    expect(after.scores).toEqual(ended.scores);
  });

  it('adds end mass across exactly three rounds and returns every original seat', () => {
    let s = kit.start();
    for (let round = 1; round <= 3; round++) {
      expect(s.round).toBe(round);
      expect(s.phase.id).toBe('play');
      s = kit.timer(
        {
          ...s,
          world: world(
            [cell('p1', { mass: 24 + round }), cell('p2', { id: 2, x: 120, mass: 30 + round })],
            { time: ROUND_MS - STEP_MS },
          ),
        },
        s.endsAt,
      );
      expect(s.phase.id).toBe('score');
      s = kit.timer(s);
      if (round < 3) {
        expect(s.world.time).toBe(0);
        expect(s.world.cells.every((c) => c.mass === 24)).toBe(true);
      }
    }
    expect(s.phase.id).toBe('done');
    expect(s.scores).toEqual({ p1: 78, p2: 96, p3: 0 });
    const res = game.results(s)!;
    expect(res.ranking.map((row) => row.playerId)).toEqual(['p2', 'p1', 'p3']);
    expect(res.ranking.every((row) => Number.isFinite(row.score))).toBe(true);
    expect(kit.timer(s)).toBe(s);
    expect(kit.input(s, 'p1', { type: 'steer', x: 1, y: 0 })).toBe(s);
  });

  it('accepts late input as the horn, never granting mass after 90 seconds', () => {
    const s = kit.start();
    const late = kit.input(s, 'p1', { type: 'steer', x: 1, y: 0 }, s.endsAt + 5000);
    expect(late.phase.id).toBe('score');
    expect(late.world.time).toBe(ROUND_MS);
    expect(late.world.controls.p1?.x).toBe(0);
  });

  it('VIP skip banks the settled mass, moves standings to the next round, and end is final', () => {
    const s = { ...kit.start(), world: world([cell('p1', { mass: 75 })]) };
    const scored = kit.vip(s, 'skip', T0 + 1000);
    expect(scored.phase.id).toBe('score');
    expect(scored.world.time).toBe(1000);
    expect(scored.lastPoints.p1).toBe(75);
    const next = kit.vip(scored, 'skip', T0 + 2000);
    expect(next.phase.id).toBe('play');
    expect(next.round).toBe(2);
    const ended = kit.vip(next, 'end', next.began + 1000);
    expect(ended.phase.id).toBe('done');
    expect(ended.scores.p1).toBeGreaterThanOrEqual(99);
    expect(game.results(ended)).not.toBeNull();
    expect(kit.vip(ended, 'end', next.began + 2000).scores).toEqual(ended.scores);
  });
});

describe('pause, stale events and reconnect', () => {
  it('releases every held pad at pause so an ignored phone stop cannot restart movement on resume', () => {
    const initial = {
      ...kit.start(),
      world: world([cell('p1'), cell('p2', { id: 2, x: 120, y: 80 })]),
    };
    const right = kit.input(initial, 'p1', { type: 'steer', x: 1, y: 0 }, T0 + 100);
    const held = deepFreeze(kit.input(right, 'p2', { type: 'steer', x: 0, y: -1 }, T0 + 100));
    const paused = deepFreeze(kit.vip(held, 'pause', T0 + 200));
    expect(paused.world.time).toBe(200);
    expect(paused.world.cells[0]!.x).toBe(62);
    expect(paused.world.cells[1]!.y).toBe(78);
    for (const id of ['p1', 'p2']) {
      expect(paused.world.controls[id]).toEqual({ ...held.world.controls[id]!, x: 0, y: 0 });
    }
    expect(held.world.controls.p1?.x).toBe(1);
    expect(held.world.controls.p2?.y).toBe(-1);
    // The disabled phone sends STOP once, then caches it and sends nothing after resume.
    const released = kit.input(paused, 'p1', { type: 'steer', x: 0, y: 0 }, T0 + 2000);
    expect(released).toBe(paused);
    expect(kit.timer(released, T0 + 3000)).toBe(paused);
    expect(released.world.time).toBe(200);
    const resumed = kit.vip(released, 'resume', T0 + 5000);
    expect(resumed.world).toEqual(paused.world);
    const stepped = kit.timer(resumed, resumed.began + 600);
    expect(stepped.world.time).toBe(600);
    expect(stepped.world.cells).toEqual(paused.world.cells);
    for (const id of ['p1', 'p2']) {
      expect(stepped.world.controls[id]).toEqual(paused.world.controls[id]);
    }
  });

  it('settles at pause, freezes all physics, and shifts wall clocks without shifting relative ones', () => {
    let s = {
      ...kit.start(),
      world: world([cell('p1', { mass: 96, mergeAt: 8000, shieldUntil: 4000 })], {
        controls: { p1: { x: 1, y: 0, at: 0, splitAt: 500 } },
        respawns: { p2: 6000 },
      }),
    };
    s = kit.vip(s, 'pause', T0 + 2000);
    expect(s.world.time).toBe(2000);
    expect(s.phase.paused?.at).toBe(T0 + 2000);
    const frozen = deepFreeze(s);
    expect(kit.input(frozen, 'p1', { type: 'steer', x: -1, y: 0 }, T0 + 6000)).toBe(frozen);
    expect(kit.timer(frozen, T0 + 8000)).toBe(frozen);
    const resumed = kit.vip(frozen, 'resume', T0 + 7000);
    expect(resumed.phase.paused).toBeUndefined();
    expect(resumed.began).toBe(T0 + 5000);
    expect(resumed.endsAt).toBe(T0 + ROUND_MS + 5000);
    expect(resumed.phase.deadline).toBe(frozen.phase.deadline! + 5000);
    expect(resumed.world).toEqual(frozen.world);
    const stepped = kit.timer(resumed);
    expect(stepped.world.time).toBeGreaterThanOrEqual(frozen.world.time);
    expect(stepped.world.cells[0]!.mergeAt).toBe(8000);
    expect(stepped.world.cells[0]!.shieldUntil).toBe(4000);
    expect(stepped.world.controls.p1?.splitAt).toBe(500);
  });

  it('skipping a paused round excludes held time from physics and points', () => {
    const s = kit.start();
    const paused = kit.vip(s, 'pause', T0 + 1000);
    const skipped = kit.vip(paused, 'skip', T0 + 61000);
    expect(skipped.phase.id).toBe('score');
    expect(skipped.world.time).toBe(1000);
    expect(skipped.world.cells).toEqual(paused.world.cells);
    expect(skipped.phase.paused).toBeUndefined();
  });

  it('an end during pause uses the frozen arena instead of adding a minute of grazing', () => {
    const paused = kit.vip(kit.start(), 'pause', T0 + 1000);
    const ended = kit.vip(paused, 'end', T0 + 61000);
    expect(ended.phase.id).toBe('done');
    expect(ended.world.time).toBe(paused.world.time);
    expect(ended.world.cells).toEqual(paused.world.cells);
  });

  it('ignores stale or wrong-phase timers and unknown/spectator inputs', () => {
    const s = deepFreeze(kit.start());
    for (const timer of [
      { type: 'timer' as const, phaseId: 'play', startedAt: T0 - 1, now: s.endsAt },
      { type: 'timer' as const, phaseId: 'score', startedAt: T0, now: s.endsAt },
    ])
      expect(kit.reduce(s, timer)).toBe(s);
    for (const id of ['spectator', '__proto__', 'constructor']) {
      expect(kit.input(s, id, { type: 'steer', x: 1, y: 1 }, T0 + 1000)).toBe(s);
      expect(kit.player(s, id, false, undefined, T0 + 1000)).toBe(s);
    }
    expect(kit.speech(s, 'missing-reading', 1000)).toBe(s);
    expect(kit.reduce(s, { type: 'speechStart', key: 'missing-reading', now: T0 + 1000 })).toBe(s);
  });

  it('stops a disconnected pad, preserves its blob, and reconnects to the same seat and score', () => {
    let s = kit.input(kit.start(), 'p1', { type: 'steer', x: 1, y: 0 }, T0 + 1000);
    s = kit.player(s, 'p1', false, undefined, T0 + 1200);
    const own = s.world.cells.filter((c) => c.owner === 'p1');
    expect(s.players.p1?.connected).toBe(false);
    expect(s.world.controls.p1?.x).toBe(0);
    expect(s.world.controls.p1?.y).toBe(0);
    expect(kit.input(s, 'p1', { type: 'steer', x: -1, y: 0 }, T0 + 1400)).toBe(s);
    const returned = kit.player(s, 'p1', true, undefined, T0 + 1200);
    expect(returned.players.p1?.connected).toBe(true);
    expect(returned.world.cells.filter((c) => c.owner === 'p1')).toEqual(own);
    expect(returned.scores).toEqual(s.scores);
    expect(game.controllerView(returned, 'p1').slot).toBe(0);
  });

  it('keeps departed seats in results, blocks their input, and never resurrects them next round', () => {
    const left = kit.player(kit.start(), 'p2', false, 'left', T0 + 1000);
    expect(left.left).toEqual(['p2']);
    expect(kit.player(left, 'p2', false, 'left', T0 + 1000).left).toEqual(['p2']);
    expect(kit.input(left, 'p2', { type: 'split' }, T0 + 2000)).toBe(left);
    expect(game.controllerView(left, 'p2').canSplit).toBe(false);
    const next = kit.vip(kit.vip(left, 'skip', T0 + 1000), 'skip', T0 + 2000);
    expect(next.world.cells.some((c) => c.owner === 'p2')).toBe(false);
    expect(next.world.controls).not.toHaveProperty('p2');
    const done = kit.vip(next, 'end', T0 + 3000);
    expect(
      game
        .results(done)!
        .ranking.map((row) => row.playerId)
        .sort(),
    ).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('public views', () => {
  it('sends each player their own mass, split reason and rank without exposing RNG or controls', () => {
    const s = {
      ...kit.start(),
      world: world([cell('p1', { mass: 96 }), cell('p2', { id: 2, x: 120 })], {
        time: 2000,
        controls: { p1: { x: 1, y: 0, at: 0, splitAt: 0 }, p2: { x: 0, y: 0, at: 0, splitAt: 0 } },
      }),
    };
    const p1 = game.controllerView(s, 'p1');
    const p2 = game.controllerView(s, 'p2');
    expect(p1.mass).toBe(96);
    expect(p2.mass).toBe(24);
    expect(p1.canSplit).toBe(true);
    expect(p2.canSplit).toBe(false);
    expect(p2.splitReason).toContain('48');
    expect(p1.arena).toBeUndefined();
    for (const view of [p1, p2, game.controllerView(s, '__proto__'), game.tvView(s)]) {
      for (const key of ['rng', 'controls', 'respawns', 'serial', 'left'])
        expect(view).not.toHaveProperty(key);
      expect(JSON.parse(JSON.stringify(view))).toEqual(view);
      expect(JSON.stringify(view).length).toBeLessThan(64 * 1024);
    }
    expect(p1).not.toEqual(p2);
    expect(game.tvView(s).cells).toEqual(s.world.cells);
  });

  it('phone-only and remote players receive the complete stage, including spectators', () => {
    const s = kit.start({
      players: testPlayers(8),
      presence: { mode: 'together', phoneOnly: true },
    });
    for (const id of [...Object.keys(s.players), 'spectator', '__proto__']) {
      expect(game.controllerView(s, id).arena).toEqual({
        cells: s.world.cells,
        pellets: s.world.pellets,
      });
      if (!Object.hasOwn(s.players, id)) expect(game.controllerView(s, id).canSplit).toBe(false);
    }
    const remote = {
      ...s,
      phoneOnly: undefined,
      players: { ...s.players, p1: { ...s.players.p1!, canSeeTv: false } },
    };
    expect(game.controllerView(remote, 'p1').arena).toBeDefined();
    expect(game.controllerView(remote, 'p2').arena).toBeUndefined();
    expect(game.controllerView(remote, 'spectator').arena).toBeUndefined();
  });

  it('split availability reflects shield, cooldown, neutral aim, cap and paused state', () => {
    const base = {
      ...kit.start(),
      world: world([cell('p1', { mass: 96 })], {
        time: 2000,
        controls: { p1: { x: 1, y: 0, at: 0, splitAt: 0 } },
      }),
    };
    expect(game.controllerView(base, 'p1').canSplit).toBe(true);
    const variants = [
      { ...base, world: { ...base.world, cells: [cell('p1', { mass: 96, shieldUntil: 3000 })] } },
      {
        ...base,
        world: { ...base.world, controls: { p1: { ...base.world.controls.p1!, splitAt: 1500 } } },
      },
      {
        ...base,
        world: { ...base.world, controls: { p1: { ...base.world.controls.p1!, x: 0, y: 0 } } },
      },
      {
        ...base,
        world: {
          ...base.world,
          cells: Array.from({ length: 4 }, (_, i) => cell('p1', { id: i, mass: 96 })),
        },
      },
      { ...base, phase: { ...base.phase, paused: { at: T0 + 2000 } } },
    ];
    for (const s of variants) expect(game.controllerView(s, 'p1').canSplit).toBe(false);
    const done = {
      ...base,
      phase: { id: 'done', startedAt: T0, deadline: null },
      scores: { p1: 50, p2: 50, p3: 80 },
    };
    expect(game.controllerView(done, 'p1').rank).toBe(2);
    expect(game.controllerView(done, 'spectator').rank).toBeNull();
    expect(game.bot.sampleInput(done, 'p1', createRng(1))).toBeNull();
    expect(radius(base.world.cells[0]!.mass)).toBeGreaterThan(0);
  });
});
