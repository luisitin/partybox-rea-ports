// Hand-built worlds pin player-visible rules independently of seeded simulation outcomes.
import { describe, expect, it } from 'vitest';
import { seedRng } from '@partybox/game-sdk';
import { roundPoints } from '../server/scoring';
import {
  aliveCount,
  apply,
  canOccupy,
  cellCenter,
  finished,
  makeMaze,
  makeTank,
  makeWorld,
  mazeCell,
  mazeNeighbors,
  tick,
  traceShell,
} from '../server/world';
import type { Bullet, Input, Maze, PowerupKind, Tank, Wall, World } from '../server/world';

const controls = (extra: Partial<Input> = {}): Input => ({
  type: 'control',
  drive: 0,
  turn: 0,
  fire: false,
  ...extra,
});
const box = (...inside: Wall[]): Maze => ({
  cols: 10,
  rows: 6,
  cell: 16,
  walls: [
    { x1: 0, y1: 0, x2: 160, y2: 0 },
    { x1: 160, y1: 0, x2: 160, y2: 96 },
    { x1: 0, y1: 96, x2: 160, y2: 96 },
    { x1: 0, y1: 0, x2: 0, y2: 96 },
    ...inside,
  ],
});
const vertical: Wall = { x1: 40, y1: 0, x2: 40, y2: 96 };
const horizontal: Wall = { x1: 0, y1: 40, x2: 160, y2: 40 };
const world = (extra: Partial<World> = {}): World => ({
  maze: box(),
  tanks: [makeTank('a', 0, 100, 70), makeTank('b', 1, 130, 70)],
  bullets: [],
  pickups: [],
  stepped: 0,
  nextBullet: 100,
  safeUntil: 0,
  ...extra,
});
const shell = (extra: Partial<Bullet> = {}): Bullet => ({
  id: 1,
  owner: 'a',
  x: 20,
  y: 20,
  vx: 43,
  vy: 0,
  born: 0,
  bounces: 0,
  kind: 'shell',
  ...extra,
});
const tank = (state: World, id: string): Tank => state.tanks.find((t) => t.id === id)!;
const heldFire = (state: World, at = 0): World => apply(state, 'a', controls({ fire: true }), at);
const shooterWorld = (extra: Partial<World> = {}): World =>
  world({
    tanks: [makeTank('a', 0, 20, 20), makeTank('b', 1, 120, 70)],
    ...extra,
  });
const armed = (kind: PowerupKind): World =>
  tick(
    shooterWorld({
      pickups: [{ id: 1, x: 20, y: 20, kind }],
    }),
    20,
  );

describe('wall ricochets and swept collisions', () => {
  it('reflects X at a vertical wall without changing Y or speed', () => {
    const out = tick(world({ maze: box(vertical), bullets: [shell({ x: 39, y: 20 })] }), 20);
    expect(out.bullets).toHaveLength(1);
    expect(out.bullets[0]!.vx).toBe(-43);
    expect(out.bullets[0]!.vy).toBe(0);
    expect(out.bullets[0]!.x).toBeLessThan(39.35);
    expect(out.bullets[0]!.bounces).toBe(1);
    expect(Math.hypot(out.bullets[0]!.vx, out.bullets[0]!.vy)).toBe(43);
  });

  it('reflects Y at a horizontal wall without changing X or speed', () => {
    const out = tick(
      world({
        maze: box(horizontal),
        bullets: [shell({ x: 20, y: 39, vx: 0, vy: 43 })],
      }),
      20,
    );
    expect(out.bullets).toHaveLength(1);
    expect(out.bullets[0]!.vx).toBe(0);
    expect(out.bullets[0]!.vy).toBe(-43);
    expect(out.bullets[0]!.y).toBeLessThan(39.35);
    expect(out.bullets[0]!.bounces).toBe(1);
    expect(Math.hypot(out.bullets[0]!.vx, out.bullets[0]!.vy)).toBe(43);
  });

  it('reflects both tied axes once at a corner and preserves speed', () => {
    const out = tick(
      world({
        maze: box(vertical, horizontal),
        bullets: [shell({ x: 39, y: 39, vx: 30, vy: 30 })],
      }),
      20,
    );
    expect(out.bullets[0]).toMatchObject({ vx: -30, vy: -30, bounces: 1 });
    expect(out.bullets[0]!.x).toBeLessThan(39.35);
    expect(out.bullets[0]!.y).toBeLessThan(39.35);
    expect(Math.hypot(out.bullets[0]!.vx, out.bullets[0]!.vy)).toBeCloseTo(Math.hypot(30, 30), 6);
    const path = traceShell(box(vertical, horizontal), { x: 39, y: 39 }, Math.PI / 4, 4);
    expect(path).toHaveLength(2);
    expect(path[1]!.x2).toBeLessThan(path[1]!.x1);
    expect(path[1]!.y2).toBeLessThan(path[1]!.y1);
  });

  it('sweeps through a tank crossed between two projectile positions', () => {
    const out = tick(
      world({
        tanks: [makeTank('a', 0, 40, 20), makeTank('b', 1, 120, 70)],
        bullets: [shell({ owner: 'b', x: 30, y: 20, vx: 1000, kind: 'beam' })],
      }),
      20,
    );
    expect(tank(out, 'a')).toMatchObject({ alive: false, died: 20 });
    expect(tank(out, 'b').alive).toBe(true);
    expect(out.bullets).toHaveLength(0);
  });

  it('keeps a fast Beam on the near side of a wall and absorbs it', () => {
    const out = tick(
      world({
        maze: box(vertical),
        bullets: [shell({ x: 39, y: 20, vx: 130, kind: 'beam' })],
      }),
      20,
    );
    expect(out.bullets).toHaveLength(0);
    expect(aliveCount(out)).toBe(2);
  });

  it('stops a moving tank at a wall and allows reversing away', () => {
    let state = world({
      maze: box(vertical),
      tanks: [makeTank('a', 0, 36, 20), makeTank('b', 1, 120, 70)],
    });
    state = tick(apply(state, 'a', controls({ drive: 1 }), 0), 1000);
    const stopped = tank(state, 'a').x;
    expect(stopped).toBeGreaterThan(36);
    expect(stopped).toBeLessThanOrEqual(37);
    expect(canOccupy(state.maze, stopped, tank(state, 'a').y)).toBe(true);
    state = tick(apply(state, 'a', controls({ drive: -1 }), 1000), 1200);
    expect(tank(state, 'a').x).toBeLessThan(stopped);
  });

  it('cannot spawn a shot through a wall when the muzzle is blocked', () => {
    const out = tick(
      heldFire(
        shooterWorld({
          maze: box(vertical),
          tanks: [makeTank('a', 0, 36.5, 20), makeTank('b', 1, 120, 70)],
        }),
      ),
      20,
    );
    expect(out.bullets).toHaveLength(0);
    expect(out.nextBullet).toBe(100);
  });

  it('prevents head-on tanks overlapping in either roster order', () => {
    const tanks = [makeTank('a', 0, 50, 40), makeTank('b', 1, 70, 40, Math.PI)];
    const run = (roster: Tank[]): World =>
      tick(
        apply(
          apply(world({ tanks: roster }), 'a', controls({ drive: 1 }), 0),
          'b',
          controls({ drive: 1 }),
          0,
        ),
        1000,
      );
    const one = run(tanks);
    const two = run([...tanks].reverse());
    expect(tank(one, 'b').x - tank(one, 'a').x).toBeGreaterThanOrEqual(6);
    expect(tank(one, 'a').x).toBe(tank(two, 'a').x);
    expect(tank(one, 'b').x).toBe(tank(two, 'b').x);
  });

  it('a blocked head-on pair cannot back into a third tank following behind', () => {
    const tanks = [
      makeTank('a', 0, 50, 40),
      makeTank('b', 1, 56.5, 40, Math.PI),
      makeTank('c', 2, 43.8, 40),
    ];
    for (const roster of [tanks, [...tanks].reverse()]) {
      let state = world({ tanks: roster });
      for (const id of ['a', 'b', 'c']) state = apply(state, id, controls({ drive: 1 }), 0);
      const out = tick(state, 20);
      expect(tank(out, 'a').x).toBe(50);
      expect(tank(out, 'b').x).toBe(56.5);
      expect(tank(out, 'c').x).toBe(43.8);
      expect(tank(out, 'b').x - tank(out, 'a').x).toBeGreaterThanOrEqual(6);
      expect(tank(out, 'a').x - tank(out, 'c').x).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('damage fairness and the final-death lock', () => {
  it('protects an owner only for muzzle clearance, then permits owner damage', () => {
    const start = world({
      tanks: [makeTank('a', 0, 20, 20), makeTank('b', 1, 120, 70)],
      bullets: [shell({ x: 20, y: 20, vx: 0 })],
    });
    const before = tick(start, 80);
    expect(tank(before, 'a').alive).toBe(true);
    const after = tick(before, 100);
    expect(tank(after, 'a')).toMatchObject({ alive: false, died: 100 });
  });

  it('a real returning ricochet destroys its owner after clearance', () => {
    const nearWall = { x1: 30, y1: 0, x2: 30, y2: 96 };
    const out = tick(heldFire(shooterWorld({ maze: box(nearWall) })), 500);
    expect(tank(out, 'a').alive).toBe(false);
    expect(tank(out, 'a').died).toBeGreaterThanOrEqual(100);
    expect(tank(out, 'b').alive).toBe(true);
  });

  it('protects all spawns for 700 ms without granting permanent immunity', () => {
    const start = world({
      safeUntil: 700,
      tanks: [makeTank('a', 0, 20, 20), makeTank('b', 1, 120, 70)],
      bullets: [shell({ owner: 'b', x: 20, y: 20, vx: 0 })],
    });
    const before = tick(start, 680);
    expect(tank(before, 'a').alive).toBe(true);
    expect(tank(tick(before, 700), 'a')).toMatchObject({ alive: false, died: 700 });
  });

  it('resolves simultaneous final deaths as a draw regardless of tank or shell order', () => {
    const tanks = [makeTank('a', 0, 20, 20), makeTank('b', 1, 120, 70)];
    const bullets = [
      shell({ owner: 'b', x: 20, y: 20, vx: 0 }),
      shell({ id: 2, owner: 'a', x: 120, y: 70, vx: 0 }),
    ];
    for (const reverse of [false, true]) {
      const out = tick(
        world({
          tanks: reverse ? [...tanks].reverse() : tanks,
          bullets: reverse ? [...bullets].reverse() : bullets,
        }),
        1000,
      );
      expect(out.tanks.map((t) => t.died)).toEqual([20, 20]);
      expect(aliveCount(out)).toBe(0);
      expect(finished(out)).toBe(true);
      expect(roundPoints(out)).toEqual({ a: 0, b: 0 });
    }
  });

  it('locks the survivor before another flying shot could kill the round winner', () => {
    const start = world({
      tanks: [makeTank('a', 0, 20, 20), makeTank('b', 1, 50, 20), makeTank('c', 2, 100, 70)],
      bullets: [
        shell({ owner: 'spectator', x: 20, y: 20, vx: 0 }),
        shell({ id: 2, owner: 'spectator', x: 50, y: 20, vx: 0 }),
        shell({ id: 3, owner: 'spectator', x: 110, y: 70, vx: -43 }),
      ],
    });
    const locked = tick(start, 20);
    expect(aliveCount(locked)).toBe(1);
    expect(roundPoints(locked)).toEqual({ a: 0, b: 0, c: 1 });
    expect(tick(locked, 10_000)).toBe(locked);
    expect(tick(start, 10_000)).toEqual(locked);
  });

  it('partitioning a catch-up preserves the same controls, shots and world', () => {
    const start = apply(shooterWorld(), 'a', controls({ drive: 1, turn: 0.2, fire: true }), 0);
    expect(tick(tick(tick(start, 200), 700), 1200)).toEqual(tick(start, 1200));
    const once = tick(start, 1200);
    expect(tick(once, 1200)).toBe(once);
    expect(tick(once, 1000)).toBe(once);
  });
});

describe('ammunition, reload and collectible weapons', () => {
  it('allows a fifth shot but never a sixth simultaneous owner projectile', () => {
    const existing = Array.from({ length: 5 }, (_, id) => shell({ id, x: 60 + id, y: 10, vx: 0 }));
    const four = tick(heldFire(shooterWorld({ bullets: existing.slice(0, 4) })), 20);
    expect(four.bullets).toHaveLength(5);
    expect(four.nextBullet).toBe(101);
    expect(tank(four, 'a').ammo).toBe(0);
    const five = tick(heldFire(shooterWorld({ bullets: existing })), 20);
    expect(five.bullets).toHaveLength(5);
    expect(five.nextBullet).toBe(100);
    expect(tank(five, 'a').ammo).toBe(0);
  });

  it('expires ordinary shells at ten seconds and releases all five capacity slots', () => {
    const start = shooterWorld({ bullets: [shell({ x: 60, y: 10, vx: 0 })] });
    const before = tick(start, 9980);
    expect(before.bullets).toHaveLength(1);
    expect(tank(before, 'a').ammo).toBe(4);
    const after = tick(before, 10_000);
    expect(after.bullets).toHaveLength(0);
    expect(tank(after, 'a').ammo).toBe(5);
  });

  it('holding fire observes the 420 ms reload and accepts the boundary shot', () => {
    const first = tick(heldFire(shooterWorld()), 20);
    expect(first.bullets).toHaveLength(1);
    expect(tank(first, 'a').reloadAt).toBe(440);
    expect(tick(first, 420).bullets).toHaveLength(1);
    expect(tick(first, 440).bullets).toHaveLength(2);
  });

  it.each(['scatter', 'beam', 'guided'] as const)(
    'collects %s once and shows its available uses',
    (kind) => {
      const state = armed(kind);
      expect(state.pickups).toHaveLength(0);
      expect(tank(state, 'a').weapon).toBe(kind);
      expect(tank(state, 'a').ammo).toBe(kind === 'scatter' ? 2 : 1);
      expect(tank(state, 'b').weapon).toBe('shell');
      const later = tick(state, 100);
      expect(tank(later, 'a').weaponUntil).toBe(12_020);
    },
  );

  it('Burst fires three distinct angles, consumes one volley and waits 700 ms', () => {
    const state = tick(heldFire(armed('scatter'), 20), 40);
    expect(state.bullets).toHaveLength(3);
    expect(state.bullets.every((b) => b.kind === 'scatter')).toBe(true);
    expect(state.bullets.map((b) => Math.sign(b.vy))).toEqual([-1, 0, 1]);
    expect(tank(state, 'a')).toMatchObject({ ammo: 1, weaponAmmo: 1, reloadAt: 740 });
    expect(tick(state, 720).nextBullet).toBe(state.nextBullet);
  });

  it('Beam is faster than a shell, consumes its one use and expires after one second', () => {
    const fired = tick(heldFire(armed('beam'), 20), 40);
    expect(fired.bullets).toHaveLength(1);
    expect(fired.bullets[0]).toMatchObject({ kind: 'beam', vx: 130, vy: 0 });
    expect(tank(fired, 'a').weaponAmmo).toBe(0);
    const start = world({ bullets: [shell({ kind: 'beam', x: 60, y: 10, vx: 0 })] });
    expect(tick(start, 980).bullets).toHaveLength(1);
    expect(tick(start, 1000).bullets).toHaveLength(0);
  });

  it('Seeker turns toward a rival after activation while preserving its speed', () => {
    const fired = tick(heldFire(armed('guided'), 20), 40);
    expect(fired.bullets[0]).toMatchObject({ kind: 'guided', vx: 34, vy: 0 });
    const before = tick(fired, 280);
    expect(before.bullets[0]!.vy).toBe(0);
    const after = tick(before, 300);
    expect(after.bullets[0]!.vy).toBeGreaterThan(0);
    expect(Math.hypot(after.bullets[0]!.vx, after.bullets[0]!.vy)).toBeCloseTo(34, 5);
    expect(tank(after, 'a').weaponAmmo).toBe(0);
  });

  it('an unused pickup reverts to ordinary shells after its twelve-second window', () => {
    const start = armed('guided');
    expect(tank(tick(start, 12_000), 'a').weapon).toBe('guided');
    expect(tank(tick(start, 12_020), 'a')).toMatchObject({
      weapon: 'shell',
      ammo: 5,
      weaponAmmo: 0,
    });
  });

  it('a tied pickup remains contested instead of favoring roster order', () => {
    const tanks = [makeTank('a', 0, 26, 40), makeTank('b', 1, 34, 40)];
    for (const roster of [tanks, [...tanks].reverse()]) {
      const state = tick(
        world({ tanks: roster, pickups: [{ id: 1, x: 30, y: 40, kind: 'beam' }] }),
        20,
      );
      expect(state.pickups).toHaveLength(1);
      expect(state.tanks.every((t) => t.weapon === 'shell')).toBe(true);
    }
  });
});

describe('connected seeded mazes and win scoring', () => {
  it('connects every cell through real doorways for reproducible independent seeds', () => {
    const layouts = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const [maze, rng] = makeMaze(seedRng(seed));
      expect(makeMaze(seedRng(seed))).toEqual([maze, rng]);
      layouts.add(JSON.stringify(maze.walls));
      const seen = new Set([0]);
      const queue = [0];
      for (let at = 0; at < queue.length; at++) {
        const from = queue[at]!;
        for (const to of mazeNeighbors(maze, from)) {
          expect(mazeNeighbors(maze, to)).toContain(from);
          const a = cellCenter(maze, from);
          const b = cellCenter(maze, to);
          const path = traceShell(maze, a, Math.atan2(b.y - a.y, b.x - a.x), 16, false);
          expect(path).toHaveLength(1);
          expect(path[0]!.x2).toBeCloseTo(b.x, 6);
          expect(path[0]!.y2).toBeCloseTo(b.y, 6);
          if (!seen.has(to)) {
            seen.add(to);
            queue.push(to);
          }
        }
      }
      expect(seen.size).toBe(maze.cols * maze.rows);
    }
    expect(layouts.size).toBeGreaterThan(1);
  });

  it.each([2, 3, 4, 5, 6, 7, 8])(
    'places %i tanks and every pickup in distinct reachable free cells',
    (count) => {
      const ids = Array.from({ length: count }, (_, i) => `p${i}`);
      for (const seed of [1, 2, 3]) {
        const [state, rng] = makeWorld(seedRng(seed), ids);
        expect(makeWorld(seedRng(seed), ids)).toEqual([state, rng]);
        expect(state.tanks.map((t) => t.id)).toEqual(ids);
        const cells = [...state.tanks, ...state.pickups].map((p) => mazeCell(state.maze, p));
        expect(new Set(cells).size).toBe(count + 3);
        expect(state.tanks.every((t) => canOccupy(state.maze, t.x, t.y))).toBe(true);
        expect(state.pickups.every((p) => canOccupy(state.maze, p.x, p.y))).toBe(true);
        expect(makeWorld(seedRng(seed), ids, false)[0].pickups).toHaveLength(0);
      }
    },
  );

  it('only the sole survivor gets exactly one round-win point', () => {
    const state = world({
      tanks: [
        { ...makeTank('a', 0, 20, 20), alive: false, died: 20 },
        makeTank('b', 1, 120, 70),
        { ...makeTank('c', 2, 70, 70), alive: false, died: 40 },
      ],
    });
    expect(roundPoints(state)).toEqual({ a: 0, b: 1, c: 0 });
  });

  it('multiple survivors at the cap earn zero, and mutual elimination earns zero', () => {
    expect(roundPoints(world())).toEqual({ a: 0, b: 0 });
    const dead = world({ tanks: world().tanks.map((t) => ({ ...t, alive: false, died: 20 })) });
    expect(roundPoints(dead)).toEqual({ a: 0, b: 0 });
  });
});
