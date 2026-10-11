import { describe, expect, it } from 'vitest';
import { createRng, seedRng } from '@partybox/game-sdk';
import { makePlayers, testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { scoresOf } from '../server/scoring';
import { SCORE_MS } from '../server/types';
import type { State } from '../server/types';
import {
  APOTHEM,
  BALL_RADIUS,
  CENTER,
  EDGES,
  INITIAL_LIVES,
  MAX_BALLS,
  MAX_SPEED,
  PADDLE_HALF,
  RESPAWN_MS,
  ROUND_MS,
  SAVES_CAP,
  SPAWN_EVERY_MS,
  SPEED,
  STEP_MS,
  aliveCount,
  apply,
  finished,
  firstCollision,
  makeWorld,
  paddleCenter,
  tick,
} from '../server/world';
import type { Ball, Paddle, World } from '../server/world';

const T0 = 1000;
const kit = testKit(game, { t0: T0, players: makePlayers(8) });
const paddle = (id: string, slot: number, extra: Partial<Paddle> = {}): Paddle => ({
  id,
  slot,
  position: 0.5,
  lives: 5,
  saves: 0,
  eliminatedAt: null,
  ...extra,
});
function shot(slot = 0, offset = 0, extra: Partial<Ball> = {}): Ball {
  const edge = EDGES[slot]!;
  return {
    id: 0,
    x: CENTER + edge.nx * (APOTHEM - BALL_RADIUS - 0.1) + edge.tx * offset,
    y: CENTER + edge.ny * (APOTHEM - BALL_RADIUS - 0.1) + edge.ty * offset,
    vx: edge.nx * SPEED,
    vy: edge.ny * SPEED,
    readyAt: 0,
    ...extra,
  };
}
const world = (ball = shot(), paddles = [paddle('p1', 0), paddle('p2', 4)]): World => ({
  paddles,
  balls: [ball],
  stepped: 0,
  spawnAngles: [0.2, 1.4, 3.1, 5.2],
});

describe('mut: arena physics', () => {
  it('starts each paddle with five lives and one moving seeded ball', () => {
    const [w, rng] = makeWorld(seedRng(7), ['p1', 'p2', 'p3']);
    expect(INITIAL_LIVES).toBe(5);
    expect(w.paddles.map((p) => p.lives)).toEqual([5, 5, 5]);
    expect(w.balls).toHaveLength(1);
    expect(Math.hypot(w.balls[0]!.vx, w.balls[0]!.vy)).toBeCloseTo(26, 9);
    expect(w.spawnAngles).toHaveLength(4);
    expect(rng.step).toBe(4);
    expect(makeWorld(seedRng(7), ['p1', 'p2', 'p3'])).toEqual([w, rng]);
  });

  it('separates seats evenly around all eight sides', () => {
    expect(makeWorld(seedRng(1), ['p1', 'p2'])[0].paddles.map((p) => p.slot)).toEqual([0, 4]);
    expect(makeWorld(seedRng(1), ['p1', 'p2', 'p3', 'p4'])[0].paddles.map((p) => p.slot)).toEqual([
      0, 2, 4, 6,
    ]);
    expect(
      makeWorld(
        seedRng(1),
        makePlayers(8).map((p) => p.id),
      )[0].paddles.map((p) => p.slot),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('maps the slider endpoints to a paddle fully inside its edge', () => {
    for (const slot of [0, 2, 4, 6]) {
      const edge = EDGES[slot]!;
      const left = paddleCenter(paddle('p1', slot, { position: 0 }));
      const right = paddleCenter(paddle('p1', slot, { position: 1 }));
      expect(Math.hypot(left.x - edge.a.x, left.y - edge.a.y)).toBeCloseTo(5.8, 9);
      expect(Math.hypot(right.x - edge.b.x, right.y - edge.b.y)).toBeCloseTo(5.8, 9);
    }
    expect(PADDLE_HALF).toBe(5.8);
  });

  it('sweeps to the first outward plane with the ball radius included', () => {
    const centerBall = { ...shot(), x: CENTER, y: CENTER };
    const collision = firstCollision(centerBall, 2)!;
    expect(collision.edge.slot).toBe(0);
    expect(collision.time).toBeCloseTo((APOTHEM - 0.85) / 26, 9);
    expect(firstCollision(centerBall, 1)).toBeNull();
    expect(BALL_RADIUS).toBe(0.85);
  });

  it('a paddle hit reflects inward, increases speed and credits exactly one save', () => {
    const w = tick(world(), 20);
    expect(w.paddles[0]).toMatchObject({ lives: 5, saves: 1, eliminatedAt: null });
    expect(w.balls[0]!.vx).toBeLessThan(0);
    expect(Math.hypot(w.balls[0]!.vx, w.balls[0]!.vy)).toBeCloseTo(26 * 1.025, 8);
    expect(STEP_MS).toBe(20);
  });

  it('a miss costs exactly one life and resets the ball for a 700 ms grace', () => {
    const w = tick(world(shot(0, 8)), 20);
    expect(w.paddles[0]).toMatchObject({ lives: 4, saves: 0, eliminatedAt: null });
    expect(w.balls[0]).toMatchObject({ x: CENTER, y: CENTER, readyAt: 720 });
    const nextAngle = 0.2 + Math.PI * (3 - Math.sqrt(5));
    expect(w.balls[0]!.vx).toBeCloseTo(Math.cos(nextAngle) * SPEED, 9);
    expect(w.balls[0]!.vy).toBeCloseTo(Math.sin(nextAngle) * SPEED, 9);
    expect(w.balls[0]!.rallies).toBe(1);
    expect(RESPAWN_MS).toBe(700);
    expect(tick(w, 720).balls[0]).toEqual(w.balls[0]);
    expect(tick(w, 740).balls[0]!.x).toBeLessThan(CENTER);
  });

  it('waits until a future serve is released', () => {
    const start = world(shot(0, 0, { x: CENTER, y: CENTER, readyAt: 1000 }));
    expect(tick(start, 1000).balls[0]).toEqual(start.balls[0]);
    expect(tick(start, 1020).balls[0]!.x).toBeGreaterThan(CENTER);
  });

  it('losing the final life records the physics sample and turns that side into a wall', () => {
    const start = world(shot(0, 8), [
      paddle('p1', 0, { lives: 1 }),
      paddle('p2', 4),
      paddle('p3', 2),
    ]);
    const out = tick(start, 20);
    expect(out.paddles[0]).toMatchObject({ lives: 0, eliminatedAt: 20 });
    const wall = tick({ ...out, balls: [shot(0, 8)], stepped: 0 }, 20);
    expect(wall.paddles[0]).toEqual(out.paddles[0]);
    expect(wall.balls[0]!.vx).toBeLessThan(0);
    expect(wall.balls[0]!.readyAt).toBe(0);
  });

  it('unoccupied sides are reflecting walls and never cost another player a life', () => {
    const w = tick(world(shot(2, 8)), 20);
    expect(w.paddles.map((p) => p.lives)).toEqual([5, 5]);
    expect(w.balls[0]!.vy).toBeLessThan(0);
    expect(w.balls[0]!.readyAt).toBe(0);
  });

  it('ends once at most one paddle is alive', () => {
    expect(finished(world())).toBe(false);
    const lone = world(shot(), [paddle('p1', 0, { lives: 0 }), paddle('p2', 4)]);
    expect(aliveCount(lone)).toBe(1);
    expect(finished(lone)).toBe(true);
    expect(tick(lone, 1000)).toBe(lone);
    expect(finished(world(shot(), [paddle('p1', 0)]))).toBe(false);
  });

  it('adds balls at 15, 30, 45 seconds and caps at four', () => {
    // No player owns a side: only wall bounces, so this isolates the spawn clock.
    const [made] = makeWorld(seedRng(9), []);
    expect(tick(made, 14980).balls).toHaveLength(1);
    expect(tick(made, 15000).balls).toHaveLength(2);
    expect(tick(made, 30000).balls).toHaveLength(3);
    expect(tick(made, 45000).balls).toHaveLength(4);
    expect(tick(made, 60000).balls).toHaveLength(4);
    expect(MAX_BALLS).toBe(4);
    expect(SPAWN_EVERY_MS).toBe(15_000);
    expect(ROUND_MS).toBe(60_000);
  });

  it('caps speed and save bonuses so one life always dominates saves', () => {
    const start = world(shot(0, 0, { vx: 3000 }), [
      paddle('p1', 0, { saves: 999 }),
      paddle('p2', 4),
    ]);
    const w = tick(start, 20);
    expect(w.paddles[0]!.saves).toBe(999);
    expect(Math.hypot(w.balls[0]!.vx, w.balls[0]!.vy)).toBeLessThanOrEqual(52 + 0.000001);
    expect(SAVES_CAP).toBe(999);
    expect(MAX_SPEED).toBe(52);
  });

  it('ignores unknown, eliminated, invalid and repeated paddle moves', () => {
    const w = world();
    expect(apply(w, 'ghost', { type: 'move', position: 0.7 })).toBe(w);
    expect(apply(w, '__proto__', { type: 'move', position: 0.7 })).toBe(w);
    expect(apply(w, 'p1', { type: 'move', position: 0.5 })).toBe(w);
    const dead = { ...w, paddles: [paddle('p1', 0, { lives: 0 }), paddle('p2', 4)] };
    expect(apply(dead, 'p1', { type: 'move', position: 0.7 })).toBe(dead);
    for (const position of [-1, 2, NaN, Infinity])
      expect(apply(w, 'p1', { type: 'move', position })).toBe(w);
    const moved = apply(w, 'p1', { type: 'move', position: 0.7 });
    expect(moved.paddles[0]!.position).toBe(0.7);
    expect(moved.paddles[1]).toBe(w.paddles[1]);
    expect(w.paddles[0]!.position).toBe(0.5);
  });

  it('catches up identically with one or partitioned ticks without mutating input', () => {
    const start = world();
    const before = JSON.stringify(start);
    const once = tick(start, 8000);
    expect(tick(tick(tick(start, 1200), 4000), 8000)).toEqual(once);
    expect(tick(once, 8000)).toBe(once);
    expect(tick(once, NaN)).toBe(once);
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe('mut: match rules', () => {
  it('starts playing immediately after the shell start stage and arms a 60-second match', () => {
    const s = kit.start();
    expect(s.phase.id).toBe('play');
    expect(s.endsAt - s.began).toBe(60_000);
    expect(s.phase.deadline).toBeGreaterThan(T0);
    expect(game.tvView(s).deadline).toBe(s.endsAt);
    expect(game.controllerView(s, 'p1').deadline).toBe(s.endsAt);
    expect(game.results(s)).toBeNull();
  });

  it('scores lives before saves, retains departed players, and shares ties', () => {
    const s = kit.start();
    const scored: State = {
      ...s,
      world: {
        ...s.world,
        paddles: [
          paddle('p1', 0, { lives: 2, saves: 0 }),
          paddle('p2', 4, { lives: 1, saves: 999 }),
          paddle('p3', 2, { lives: 2, saves: 0 }),
        ],
      },
    };
    const scores = scoresOf(scored);
    expect(scores.p1).toBe(2000);
    expect(scores.p2).toBe(1999);
    expect(scores.p3).toBe(2000);
    expect(Object.keys(scores)).toHaveLength(8);
    const done = { ...scored, phase: { id: 'done', startedAt: T0, deadline: null }, scores };
    expect(game.results(done)?.winnerIds.sort()).toEqual(['p1', 'p3']);
    expect(game.results(done)?.ranking.filter((row) => row.rank === 1)).toHaveLength(2);
  });

  it('a live deadline settles physics, shows score for six seconds, then reaches done', () => {
    const start = kit.start();
    const safe = {
      ...start,
      world: { ...start.world, paddles: start.world.paddles.map((p) => ({ ...p, lives: 100 })) },
    };
    const score = kit.timer(safe, safe.endsAt);
    expect(score.phase.id).toBe('score');
    expect(score.checked).toBe(60_000);
    expect(score.phase.deadline).toBe(score.phase.startedAt + SCORE_MS);
    expect(SCORE_MS).toBe(6000);
    expect(score.scores).toEqual(scoresOf(score));
    const done = kit.timer(score);
    expect(done.phase.id).toBe('done');
    expect(game.results(done)).not.toBeNull();
    expect(kit.timer(done)).toEqual(done);
  });

  it('stale timers and input from spectators leave the state untouched', () => {
    const s = kit.start();
    expect(
      game.reduce(s, { type: 'timer', now: s.endsAt, phaseId: 'play', startedAt: T0 - 1 }),
    ).toBe(s);
    expect(game.reduce(s, { type: 'timer', now: s.endsAt, phaseId: 'score', startedAt: T0 })).toBe(
      s,
    );
    expect(kit.input(s, 'ghost', { type: 'move', position: 0.8 }, T0 + 100)).toBe(s);
    expect(kit.input(s, '__proto__', { type: 'move', position: 0.8 }, T0 + 100)).toBe(s);
    expect(kit.input(s, 'p1', { type: 'move', position: 0.8 }, T0 - 1)).toBe(s);
  });

  it('pausing freezes inputs and timers; resuming shifts both match clocks', () => {
    const s = kit.start();
    const paused = kit.vip(s, 'pause', T0 + 2000);
    expect(paused.phase.paused).toEqual({ at: T0 + 2000 });
    expect(kit.input(paused, 'p1', { type: 'move', position: 0.8 }, T0 + 3000)).toBe(paused);
    expect(kit.timer(paused, s.endsAt)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', T0 + 7000);
    expect(resumed.phase.paused).toBeUndefined();
    expect(resumed.began).toBe(s.began + 5000);
    expect(resumed.endsAt).toBe(s.endsAt + 5000);
    expect(resumed.world).toEqual(paused.world);
  });

  it('VIP skip settles the rally into score and end produces complete final results', () => {
    const s = kit.start();
    const score = kit.vip(s, 'skip', T0 + 3000);
    expect(score.phase.id).toBe('score');
    expect(score.checked).toBe(3000);
    expect(kit.vip(score, 'skip').phase.id).toBe('done');
    const done = kit.vip(s, 'end', T0 + 3000);
    expect(done.phase.id).toBe('done');
    expect(game.results(done)?.ranking).toHaveLength(8);
  });

  it('disconnect/reconnect retains paddle position and never stalls completion', () => {
    const s = kit.input(kit.start(), 'p1', { type: 'move', position: 0.73 }, T0 + 100);
    const dropped = kit.player(s, 'p1', false, undefined, T0 + 200);
    const joined = kit.player(dropped, 'p1', true, undefined, T0 + 300);
    expect(joined.players.p1!.connected).toBe(true);
    expect(joined.world.paddles.find((p) => p.id === 'p1')!.position).toBe(0.73);
    const left = kit.player(joined, 'p1', false, 'left', T0 + 400);
    expect(game.results(kit.vip(left, 'end'))?.scores).toHaveProperty('p1');
  });

  it('views carry public arena state and omit future launches and random state', () => {
    const s = kit.start();
    const viewers = ['p1', 'p2', 'ghost', '__proto__'];
    for (const view of [game.tvView(s), ...viewers.map((id) => game.controllerView(s, id))]) {
      expect(JSON.stringify(view)).not.toContain('spawnAngles');
      expect(JSON.stringify(view)).not.toContain('rng');
    }
    expect(game.controllerView(s, 'p1').me.role).toBe('player');
    expect(game.controllerView(s, '__proto__').me.role).toBe('spectator');
    const changedSecrets = {
      ...s,
      rng: seedRng(999),
      world: { ...s.world, spawnAngles: s.world.spawnAngles.map((angle) => angle + 0.71) },
    };
    expect(game.tvView(changedSecrets)).toEqual(game.tvView(s));
    for (const id of viewers)
      expect(game.controllerView(changedSecrets, id)).toEqual(game.controllerView(s, id));
  });

  it('all three bot strengths use legal moves and ignore spectators and terminal screens', () => {
    const start = kit.start();
    const s = { ...start, world: { ...start.world, balls: [shot(0, 8)] } };
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      const input = game.bot.sampleInput(s, 'p1', createRng(14), skill);
      expect(input).not.toBeNull();
      expect(game.inputSchema.safeParse(input).success).toBe(true);
      expect(game.bot.sampleInput(s, '__proto__', createRng(14), skill)).toBeNull();
      expect(game.bot.sampleInput(kit.vip(s, 'end'), 'p1', createRng(14), skill)).toBeNull();
    }
  });
});
