// Pin static firing-line predictions against judged collisions and owner immunity.
import { describe, expect, it } from 'vitest';
import { shotTarget } from '../server/bot';
import {
  OWNER_SAFE_MS,
  SHELL_RADIUS,
  STEP_MS,
  TANK_RADIUS,
  apply,
  canOccupy,
  makeTank,
  tick,
} from '../server/world';
import type { Maze, Tank, Wall, Weapon, World } from '../server/world';

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
const scene = (tanks: Tank[], ...inside: Wall[]): World => ({
  maze: box(...inside),
  tanks,
  bullets: [],
  pickups: [],
  stepped: 0,
  nextBullet: 1,
  safeUntil: 0,
});
function weapon(tank: Tank, kind: Weapon): Tank {
  return { ...tank, weapon: kind, weaponAmmo: kind === 'shell' ? 0 : 1, weaponUntil: 12_000 };
}
const fire = (world: World): World =>
  apply(
    world,
    'a',
    {
      type: 'control',
      drive: 0,
      turn: 0,
      fire: true,
    },
    0,
  );
const alive = (world: World, id: string): boolean =>
  world.tanks.find((tank) => tank.id === id)!.alive;

describe('bot shot safety and actual first contacts', () => {
  it('rejects a muzzle reaching across a wall without firing or spending shell capacity', () => {
    const me = makeTank('a', 0, 28.9, 24);
    const world = scene([me, makeTank('b', 1, 40, 24)], {
      x1: 32,
      y1: 0,
      x2: 32,
      y2: 80,
    });
    expect(canOccupy(world.maze, me.x, me.y)).toBe(true);
    expect(
      canOccupy(world.maze, me.x + TANK_RADIUS + SHELL_RADIUS + 0.15, me.y, SHELL_RADIUS),
    ).toBe(true);
    expect(shotTarget(world, me, 0)).toBeNull();
    const out = tick(fire(world), 200);
    expect(out.bullets).toHaveLength(0);
    expect(out.tanks[0]!.ammo).toBe(me.ammo);
    expect(out.tanks[0]!.reloadAt).toBe(me.reloadAt);
    expect(alive(out, 'a')).toBe(true);
    expect(alive(out, 'b')).toBe(true);
  });

  it.each(['shell', 'guided'] as const)(
    'rejects the short %s wall return that kills its owner',
    (kind) => {
      const me = weapon(makeTank('a', 0, 26, 24), kind);
      const world = scene([me, makeTank('b', 1, 16, 24)], {
        x1: 32,
        y1: 0,
        x2: 32,
        y2: 80,
      });
      expect(shotTarget(world, me, 0)).toBeNull();
      const shot = fire(world);
      const protectedWorld = tick(shot, OWNER_SAFE_MS);
      expect(alive(protectedWorld, 'a')).toBe(true);
      const out = tick(shot, OWNER_SAFE_MS + STEP_MS);
      expect(alive(out, 'a')).toBe(false);
      expect(alive(out, 'b')).toBe(true);
      expect(out.tanks[0]!.died).toBe(OWNER_SAFE_MS + STEP_MS);
    },
  );

  it.each(['shell', 'beam', 'guided'] as const)('still accepts a safe direct %s hit', (kind) => {
    const me = weapon(makeTank('a', 0, 24, 24), kind);
    const world = scene([me, makeTank('b', 1, 32, 24)]);
    expect(shotTarget(world, me, 0)).toBe('b');
    const out = tick(fire(world), 100);
    expect(alive(out, 'a')).toBe(true);
    expect(alive(out, 'b')).toBe(false);
  });

  it('accepts a safe bank shot while Beam correctly stops at that wall', () => {
    const angle = Math.atan2(24, 2 * (64 - SHELL_RADIUS) - 48);
    const me = makeTank('a', 0, 24, 24, angle);
    const world = scene([me, makeTank('b', 1, 24, 48)], {
      x1: 64,
      y1: 0,
      x2: 64,
      y2: 80,
    });
    expect(shotTarget(world, me, angle)).toBe('b');
    const out = tick(fire(world), 2500);
    expect(alive(out, 'a')).toBe(true);
    expect(alive(out, 'b')).toBe(false);
    const beam = weapon(me, 'beam');
    const beamWorld = { ...world, tanks: [beam, world.tanks[1]!] };
    expect(shotTarget(beamWorld, beam, angle)).toBeNull();
    const blocked = tick(fire(beamWorld), 1000);
    expect(alive(blocked, 'a')).toBe(true);
    expect(alive(blocked, 'b')).toBe(true);
  });

  it('chooses first circle entry over the nearer center for two non-overlapping rivals', () => {
    const me = makeTank('a', 0, 10, 20);
    const graze = makeTank('b', 1, 30, 23.6);
    const first = makeTank('c', 2, 32.3, 18);
    for (const rivals of [
      [graze, first],
      [first, graze],
    ]) {
      const world = scene([me, ...rivals]);
      expect(shotTarget(world, me, 0)).toBe('c');
      const out = tick(fire(world), 400);
      expect(alive(out, 'c')).toBe(false);
      expect(alive(out, 'b')).toBe(true);
      expect(alive(out, 'a')).toBe(true);
    }
  });

  it('rejects Burst when a side pellet kills its owner before the safe center reaches the rival', () => {
    const me = weapon(makeTank('a', 0, 26, 33), 'scatter');
    const world = scene([me, makeTank('b', 1, 40, 33)], {
      x1: 32,
      y1: 16,
      x2: 32,
      y2: 32,
    });
    expect(shotTarget(world, me, 0)).toBeNull();
    const center = weapon(me, 'shell');
    const centerWorld = { ...world, tanks: [center, world.tanks[1]!] };
    expect(shotTarget(centerWorld, center, 0)).toBe('b');
    const safeCenter = tick(fire(centerWorld), 160);
    expect(alive(safeCenter, 'a')).toBe(true);
    expect(alive(safeCenter, 'b')).toBe(false);
    const burst = fire(world);
    expect(alive(tick(burst, 100), 'a')).toBe(true);
    const out = tick(burst, 120);
    expect(alive(out, 'a')).toBe(false);
    expect(alive(out, 'b')).toBe(true);
    expect(out.tanks[0]!.died).toBe(120);
  });

  it('accepts safe Burst and ignores a side pellet blocked at its muzzle', () => {
    const me = weapon(makeTank('a', 0, 28.9, 33), 'scatter');
    const world = scene([me, makeTank('b', 1, 40, 33)], {
      x1: 32,
      y1: 16,
      x2: 32,
      y2: 32,
    });
    expect(shotTarget(world, me, 0)).toBe('b');
    const shot = fire(world);
    expect(tick(shot, STEP_MS).bullets).toHaveLength(2);
    const out = tick(shot, 200);
    expect(alive(out, 'a')).toBe(true);
    expect(alive(out, 'b')).toBe(false);
  });

  it('accepts a safe outer-only Burst hit when the center misses', () => {
    const me = weapon(makeTank('a', 0, 24, 24), 'scatter');
    const world = scene([me, makeTank('b', 1, 60, 34)]);
    const center = weapon(me, 'shell');
    expect(shotTarget({ ...world, tanks: [center, world.tanks[1]!] }, center, 0)).toBeNull();
    expect(shotTarget(world, me, 0)).toBe('b');
    const out = tick(fire(world), 1000);
    expect(alive(out, 'a')).toBe(true);
    expect(alive(out, 'b')).toBe(false);
  });
});
