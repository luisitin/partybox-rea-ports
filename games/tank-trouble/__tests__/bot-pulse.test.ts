// Judge bot commands through real physics; a preview never authorizes a later unpreviewed volley.
import { createRng } from '@partybox/game-sdk';
import { describe, expect, it } from 'vitest';
import { botInput, shotTarget } from '../server/bot';
import { SHELL_RADIUS, SHELL_SPEED, TANK_RADIUS, apply, makeTank, tick } from '../server/world';
import type { Tank, Wall, Weapon, World } from '../server/world';

const scene = (tanks: Tank[], ...inside: Wall[]): World => ({
  maze: {
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
  },
  tanks,
  bullets: [],
  pickups: [],
  stepped: 0,
  nextBullet: 1,
  safeUntil: 0,
});
const alive = (world: World, id: string): boolean =>
  world.tanks.find((tank) => tank.id === id)!.alive;
const armed = (tank: Tank, kind: Weapon): Tank => ({
  ...tank,
  weapon: kind,
  weaponAmmo: kind === 'shell' ? 0 : kind === 'scatter' ? 2 : 1,
  weaponUntil: 12_000,
});
function ownedShells(world: World, count: number): World {
  return {
    ...world,
    bullets: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      owner: 'a',
      x: 120,
      y: 80,
      vx: 0,
      vy: SHELL_SPEED,
      born: 1000,
      bounces: 0,
      kind: 'shell' as const,
    })),
    nextBullet: count + 1,
  };
}

// Tests preserve the unsafe ordinary held command to prove each failure against actual physics.
describe('bot immediate one-volley firing', () => {
  it('holds the previewed pose instead of rotating its safe line into an owner return', () => {
    const me = makeTank('a', 0, 26, 32.7);
    const world: World = {
      ...scene([me, makeTank('b', 1, 24, 24), makeTank('c', 2, 40, 32.7)], {
        x1: 32,
        y1: 16,
        x2: 32,
        y2: 32,
      }),
      stepped: 50,
      safeUntil: 700,
    };
    expect(shotTarget(world, me, 0)).toBe('c');
    // The old bot selected nearer b for steering but c for the present firing line.
    const unsafe = tick(
      apply(world, 'a', { type: 'control', drive: 0, turn: -1, fire: true }, 1000),
      1120,
    );
    expect(unsafe.tanks[0]!.died).toBe(1120);
    expect(alive(unsafe, 'a')).toBe(false);
    expect(alive(unsafe, 'b')).toBe(true);
    expect(alive(unsafe, 'c')).toBe(true);

    const input = botInput(world, 'a', 1000, createRng(1), 'normal');
    expect(input).toEqual({ type: 'control', drive: 0, turn: 0, fire: true, pulse: true });
    const judged = tick(apply(world, 'a', input!, 1000), 2200);
    expect(alive(judged, 'a')).toBe(true);
    expect(alive(judged, 'b')).toBe(true);
    expect(alive(judged, 'c')).toBe(false);
    expect(judged.tanks[0]).toMatchObject({
      x: 26,
      y: 32.7,
      angle: 0,
      drive: 0,
      turn: 0,
      fire: false,
      firePulse: false,
    });
  });

  it('does not reload its cleared firing line into a wall after the first target dies', () => {
    const me = makeTank('a', 0, 24, 24);
    const world: World = {
      ...scene([me, makeTank('b', 1, 32, 24), makeTank('c', 2, 24, 48)], {
        x1: 40,
        y1: 16,
        x2: 40,
        y2: 32,
      }),
      stepped: 50,
      safeUntil: 700,
    };
    expect(shotTarget(world, me, 0)).toBe('b');
    const held = apply(world, 'a', { type: 'control', drive: 0, turn: 0, fire: true }, 1000);
    expect(alive(tick(held, 1020), 'b')).toBe(false);
    const repeated = tick(held, 2200);
    expect(alive(repeated, 'a')).toBe(false);
    expect(repeated.tanks[0]!.died).toBe(1980);

    const input = botInput(world, 'a', 1000, createRng(2), 'normal');
    expect(input).toEqual({ type: 'control', drive: 0, turn: 0, fire: true, pulse: true });
    const judged = tick(apply(world, 'a', input!, 1000), 2200);
    expect(alive(judged, 'a')).toBe(true);
    expect(alive(judged, 'b')).toBe(false);
    expect(alive(judged, 'c')).toBe(true);
    expect(judged.nextBullet).toBe(2);
    expect(judged.bullets).toHaveLength(0);
    expect(judged.tanks[0]!.fire).toBe(false);
  });

  it('keeps its escape command instead of freezing to fire into an incoming shell path', () => {
    const me = makeTank('a', 0, 24, 24);
    const world: World = {
      ...scene([me, makeTank('b', 1, 40, 24), makeTank('c', 2, 120, 80)]),
      bullets: [
        {
          id: 1,
          owner: 'c',
          x: 24,
          y: 8,
          vx: 0,
          vy: SHELL_SPEED,
          born: 0,
          bounces: 0,
          kind: 'shell',
        },
      ],
      nextBullet: 2,
    };
    expect(shotTarget(world, me, 0)).toBe('b');
    const input = botInput(world, 'a', 0, createRng(3), 'normal');
    expect(input).toEqual({ type: 'control', drive: 1, turn: 0, fire: false });
    const escaped = tick(apply(world, 'a', input!, 0), 600);
    expect(alive(escaped, 'a')).toBe(true);
    expect(alive(escaped, 'b')).toBe(true);
    expect(escaped.tanks[0]!.x).toBeGreaterThan(me.x + TANK_RADIUS + SHELL_RADIUS);
    const frozen = tick(
      apply(world, 'a', { type: 'control', drive: 0, turn: 0, fire: true }, 0),
      600,
    );
    expect(alive(frozen, 'a')).toBe(false);
    expect(frozen.tanks[0]!.died).toBe(300);
  });

  it.each(['shell', 'scatter', 'beam', 'guided'] as const)(
    'keeps a useful immediate %s bot volley',
    (kind) => {
      const me = armed(makeTank('a', 0, 24, 24), kind);
      const world = scene([me, makeTank('b', 1, 32, 24)]);
      const input = botInput(world, 'a', 0, createRng(4), 'normal');
      expect(input).toEqual({ type: 'control', drive: 0, turn: 0, fire: true, pulse: true });
      const judged = tick(apply(world, 'a', input!, 0), 100);
      expect(alive(judged, 'a')).toBe(true);
      expect(alive(judged, 'b')).toBe(false);
    },
  );

  it.each(['reload', 'spawn', 'shell-capacity', 'burst-capacity', 'expiry', 'ammo'] as const)(
    'does not queue a stale preview behind %s',
    (reason) => {
      let me = makeTank('a', 0, 24, 24);
      let world: World = {
        ...scene([me, makeTank('b', 1, 32, 24)]),
        stepped: 50,
        safeUntil: 700,
      };
      let checked = 1000;
      if (reason === 'reload') me = { ...me, reloadAt: 1040 };
      if (reason === 'spawn') {
        checked = 600;
        world = { ...world, stepped: 30 };
      }
      if (reason === 'burst-capacity') me = armed(me, 'scatter');
      if (reason === 'expiry') me = { ...armed(me, 'guided'), weaponUntil: 1020 };
      if (reason === 'ammo') me = { ...armed(me, 'scatter'), weaponAmmo: 0 };
      world = { ...world, tanks: [me, world.tanks[1]!] };
      if (reason === 'shell-capacity') world = ownedShells(world, 5);
      if (reason === 'burst-capacity') world = ownedShells(world, 3);
      expect(shotTarget(world, me, 0)).toBe('b');
      const input = botInput(world, 'a', checked, createRng(5), 'normal');
      expect(input).not.toBeNull();
      expect(input!.fire).toBe(false);
      const judged = tick(apply(world, 'a', input!, checked), checked + 1200);
      expect(judged.nextBullet).toBe(world.nextBullet);
      expect(alive(judged, 'a')).toBe(true);
      expect(alive(judged, 'b')).toBe(true);
    },
  );

  it('accepts a pulse due at the next sample with one free slot and an unexpired weapon', () => {
    const me = { ...armed(makeTank('a', 0, 24, 24), 'guided'), reloadAt: 1020, weaponUntil: 1040 };
    const world = ownedShells(
      { ...scene([me, makeTank('b', 1, 32, 24)]), stepped: 50, safeUntil: 1020 },
      4,
    );
    const input = botInput(world, 'a', 1000, createRng(6), 'normal');
    expect(input).toEqual({ type: 'control', drive: 0, turn: 0, fire: true, pulse: true });
    const judged = tick(apply(world, 'a', input!, 1000), 1020);
    expect(judged.nextBullet).toBe(world.nextBullet + 1);
    expect(alive(judged, 'a')).toBe(true);
    expect(alive(judged, 'b')).toBe(false);
    expect(judged.tanks[0]!.fire).toBe(false);
  });

  it('keeps ordinary human held Fire queued behind reload', () => {
    const me = { ...makeTank('a', 0, 24, 24), reloadAt: 1040 };
    const world: World = { ...scene([me, makeTank('b', 1, 32, 24)]), stepped: 50 };
    const held = apply(world, 'a', { type: 'control', drive: 0, turn: 0, fire: true }, 1000);
    expect(tick(held, 1020).nextBullet).toBe(1);
    const judged = tick(held, 1040);
    expect(judged.nextBullet).toBe(2);
    expect(alive(judged, 'b')).toBe(false);
    expect(judged.tanks[0]!.fire).toBe(true);
    expect(judged.tanks[0]!.firePulse).toBe(false);
  });
});
