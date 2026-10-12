// Lifecycle, trust boundaries and pause/reconnect behavior, independent of physical balance.
import { createRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { ROUND_MS, STEP_MS, TICK_MS } from '../server/world';
import type { State } from '../server/types';

const kit = testKit(game, { players: testPlayers(2) });
const command = { type: 'control' as const, drive: 1, turn: 0, fire: true };
const neutral = { type: 'control' as const, drive: 0, turn: 0, fire: false };
const tank = (state: State, id = 'p1') => state.world.tanks.find((t) => t.id === id)!;

describe('input and clock boundaries', () => {
  it('starts immediately after the shell countdown, with five fixed rounds', () => {
    const state = kit.start();
    expect(state.phase.id).toBe('play');
    expect(state.phase.deadline).toBe(kit.t0 + TICK_MS);
    expect(state.endsAt).toBe(kit.t0 + ROUND_MS);
    expect(game.tvView(state).rounds).toBe(5);
  });

  it.each(['ghost', '__proto__', 'constructor', ''])(
    'ignores unknown input/player %s without advancing combat',
    (id) => {
      const state = kit.start();
      expect(kit.input(state, id, command, kit.t0 + 20_000)).toBe(state);
      expect(kit.player(state, id, false, undefined, kit.t0 + 20_000)).toBe(state);
    },
  );

  it('rejects stale phase instances, incorrect phase ids and premature timers', () => {
    const state = kit.start();
    expect(
      game.reduce(state, {
        type: 'timer',
        now: state.endsAt,
        phaseId: 'play',
        startedAt: kit.t0 - 1,
      }),
    ).toBe(state);
    expect(
      game.reduce(state, { type: 'timer', now: state.endsAt, phaseId: 'ready', startedAt: kit.t0 }),
    ).toBe(state);
    expect(kit.timer(state, kit.t0 + 1)).toBe(state);
  });

  it('rejects inputs from before already judged time and re-arms the same timer instance', () => {
    const state = kit.timer(kit.start());
    expect(state.phase.startedAt).toBe(kit.t0);
    expect(state.phase.deadline).toBe(kit.t0 + 2 * TICK_MS);
    expect(kit.input(state, 'p1', command, kit.t0 + TICK_MS - 1)).toBe(state);
  });

  it('latches a valid input without mutating the original state', () => {
    const state = kit.start();
    const before = JSON.stringify(state);
    const next = kit.input(state, 'p1', command, kit.t0 + 1);
    expect(tank(next).drive).toBe(1);
    expect(tank(next).fire).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    expect(tank(kit.input(next, 'p1', neutral, kit.t0 + 2)).fire).toBe(false);
  });
});

describe('pause and presence', () => {
  it('holds inputs/timers, shifts round clocks and retains the phase instance on resume', () => {
    const state = kit.start();
    const paused = kit.vip(state, 'pause', kit.t0 + 100);
    expect(paused.phase.paused?.at).toBe(kit.t0 + 100);
    expect(kit.input(paused, 'p1', command, kit.t0 + 500)).toBe(paused);
    expect(kit.timer(paused, kit.t0 + 50_000)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', kit.t0 + 10_100);
    expect(resumed.phase.paused).toBeUndefined();
    expect(resumed.began).toBe(state.began + 10_000);
    expect(resumed.endsAt).toBe(state.endsAt + 10_000);
    expect(resumed.phase.deadline).toBe(state.phase.deadline! + 10_000);
    expect(resumed.world).toEqual(paused.world);
    expect(game.tvView(resumed).phaseAt).toBe(game.tvView(state).phaseAt);
  });

  it('a skip while paused excludes held time and scores once', () => {
    const state = kit.start();
    const paused = kit.vip(state, 'pause', kit.t0 + 100);
    const skipped = kit.vip(paused, 'skip', kit.t0 + 50_100);
    expect(skipped.phase.id).toBe('score');
    expect(skipped.began).toBe(state.began + 50_000);
    expect(skipped.checked).toBeLessThanOrEqual(100 + STEP_MS);
    expect(Object.values(skipped.scores)).toEqual([0, 0]);
  });

  it('a drop releases controls, rejects offline input, and a temporary reconnect keeps the same tank', () => {
    const held = kit.input(kit.start(), 'p1', command, kit.t0 + 1);
    const dropped = kit.player(held, 'p1', false, undefined, kit.t0 + 2);
    expect(game.controllerView(dropped, 'p1').participating).toBe(true);
    expect(tank(dropped).drive).toBe(0);
    expect(tank(dropped).fire).toBe(false);
    expect(kit.input(dropped, 'p1', command, kit.t0 + 10)).toBe(dropped);
    const returned = kit.player(dropped, 'p1', true, undefined, kit.t0 + 10);
    expect(game.controllerView(returned, 'p1').participating).toBe(true);
    expect(tank(returned).x).toBe(tank(dropped).x);
    expect(tank(returned).id).toBe('p1');
    expect(tank(kit.input(returned, 'p1', command, kit.t0 + 11)).fire).toBe(true);
  });

  it('permanent leaves never respawn or take controls, even after reconnect', () => {
    const state = { ...kit.start({ players: testPlayers(3) }), scores: { p1: 3, p2: 0, p3: 0 } };
    const left = kit.player(state, 'p1', false, 'left', kit.t0 + 1);
    expect(tank(left).alive).toBe(false);
    expect(left.left).toContain('p1');
    expect(game.controllerView(left, 'p1').participating).toBe(false);
    const returned = kit.player(left, 'p1', true, undefined, kit.t0 + 2);
    expect(game.controllerView(returned, 'p1').participating).toBe(false);
    expect(kit.input(returned, 'p1', command, kit.t0 + 3)).toBe(returned);
    const ready = kit.vip(kit.vip(returned, 'skip', kit.t0 + 4), 'skip', kit.t0 + 5);
    expect(ready.phase.id).toBe('ready');
    expect(ready.world.tanks.map((t) => t.id)).not.toContain('p1');
    expect(Object.keys(ready.scores)).toContain('p1');
    const view = game.controllerView(ready, 'p1');
    expect(view.participating).toBe(false);
    expect(view.slot).toBe(-1);
    expect(view.me.role).toBe('player');
    expect(view.alive).toBe(false);
    expect(view.scores.p1).toBe(3);
    const done = kit.vip(ready, 'end', kit.t0 + 6);
    const final = game.controllerView(done, 'p1');
    expect(final.participating).toBe(false);
    expect(final.me.role).toBe('player');
    expect(final.scores.p1).toBe(3);
    expect(final.rank).toBe(1);
    expect(final.tied).toBe(false);
    expect(game.results(done)!.winnerIds).toEqual(['p1']);
  });

  it('finishes a drop-completed fight on resume instead of waiting for a timer', () => {
    const paused = kit.vip(kit.start(), 'pause', kit.t0 + 1);
    const left = kit.player(paused, 'p1', false, 'kicked', kit.t0 + 2);
    expect(left.phase.id).toBe('play');
    const resumed = kit.vip(left, 'resume', kit.t0 + 10);
    expect(resumed.phase.id).toBe('score');
    expect(resumed.scores).toEqual({ p1: 0, p2: 1 });
  });
});

describe('public views and terminal outcomes', () => {
  it('the final TV winner list matches match totals, including ties and departed winners', () => {
    const base = kit.start({ players: testPlayers(3) });
    const scoring: State = {
      ...base,
      round: 5,
      scores: { p1: 3, p2: 3, p3: 1 },
      winnerIds: ['p3'],
      left: ['p1'],
      phase: { id: 'score', startedAt: kit.t0, deadline: kit.t0 + 1 },
    };
    const done = kit.timer(scoring);
    expect(game.tvView(done).winnerIds).toEqual(['p1', 'p2']);
    expect(game.tvView(done).winnerIds).toEqual(game.results(done)!.winnerIds);
    const ended = kit.vip({ ...base, scores: { p1: 5, p2: 0, p3: 1 }, winnerIds: ['p3'] }, 'end');
    expect(game.tvView(ended).winnerIds).toEqual(['p1']);
  });
  it('all surfaces share the present public arena and omit rng/config/future metadata', () => {
    const state = kit.start({ players: testPlayers(8) });
    const tv = game.tvView(state);
    for (const id of ['p1', 'p2', 'ghost', '__proto__']) {
      const cv = game.controllerView(state, id);
      expect(cv.arena).toEqual(tv.arena);
      expect(cv.me.role).toBe(['p1', 'p2'].includes(id) ? 'player' : 'spectator');
      expect(cv.participating).toBe(['p1', 'p2'].includes(id));
      for (const field of ['rng', 'left', 'settings', 'nextBullet', 'safeUntil']) {
        expect(cv).not.toHaveProperty(field);
        expect(cv.arena).not.toHaveProperty(field);
      }
      expect(JSON.parse(JSON.stringify(cv))).toEqual(cv);
    }
  });

  it('has no results before done, retains all scores on VIP end and stays terminal', () => {
    const state = kit.start();
    expect(game.results(state)).toBeNull();
    const done = kit.vip(state, 'end', kit.t0 + 1);
    expect(game.results(done)!.scores).toEqual({ p1: 0, p2: 0 });
    expect(game.results(done)!.winnerIds).toEqual(['p1', 'p2']);
    expect(game.controllerView(done, 'p1').rank).toBe(1);
    expect(game.controllerView(done, 'p1').tied).toBe(true);
    expect(game.controllerView(done, 'ghost').rank).toBeNull();
    expect(kit.input(done, 'p1', command, kit.t0 + 2)).toBe(done);
    expect(kit.timer(done, kit.t0 + 3)).toBe(done);
  });

  it('ends passive play after exactly five capped rounds, drawing instead of rewarding campers', () => {
    let state = kit.start();
    for (let round = 1; round <= 5; round++) {
      expect(state.phase.id).toBe('play');
      expect(state.round).toBe(round);
      state = kit.timer(state, state.endsAt);
      expect(state.phase.id).toBe('score');
      expect(state.scores).toEqual({ p1: 0, p2: 0 });
      state = kit.timer(state);
      if (round < 5) {
        expect(state.phase.id).toBe('ready');
        state = kit.timer(state);
      }
    }
    expect(state.phase.id).toBe('done');
    expect(game.results(state)!.winnerIds).toEqual(['p1', 'p2']);
  });

  it('all three bot strengths act only for living connected players with schema-valid commands', () => {
    const state = kit.start();
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      const input = game.bot.sampleInput(state, 'p1', createRng(42), skill);
      expect(input).not.toBeNull();
      expect(game.inputSchema.safeParse(input).success).toBe(true);
      expect(game.bot.sampleInput(state, 'ghost', createRng(42), skill)).toBeNull();
      expect(
        game.bot.sampleInput(
          kit.player(state, 'p1', false, undefined, kit.t0),
          'p1',
          createRng(42),
          skill,
        ),
      ).toBeNull();
    }
  });
});
