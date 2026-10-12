// Fixed-step public facade; maze generation and swept collisions stay independently testable.
import {
  MAX_SHELLS,
  OMEGA,
  RELOAD_MS,
  ROUND_MS,
  SHELL_RADIUS,
  SHELL_SPEED,
  SPEED,
  STEP_MS,
  INPUT_LEASE_MS,
  TANK_RADIUS,
  angleDelta,
  inputSchema,
  round,
  sq,
} from './world-core';
import type { Arena, Bullet, Input, Pickup, Tank, Wall, World } from './world-core';
import { canOccupy, clear, firstWall, moveBullet, nearby, wallBuckets } from './collision';
export * from './world-core';
export { makeMaze, makeWorld, mazeCell, mazeNeighbors, cellCenter } from './maze';
export { canOccupy, traceShell } from './collision';

export const aliveCount = (world: Arena): number => world.tanks.filter((t) => t.alive).length;
export const finished = (world: Arena): boolean => aliveCount(world) <= 1;

/** One simultaneous physics sample. Bodies cannot pass walls or each other. */
function step(world: World, t: number, buckets: Map<number, Wall[]>): World {
  let tanks = world.tanks.map((tank) => {
    if (!tank.alive) return tank;
    const held = t < tank.inputUntil;
    let next: Tank = {
      ...tank,
      drive: held ? tank.drive : 0,
      turn: held ? tank.turn : 0,
      fire: held && tank.fire,
    };
    if (next.weapon !== 'shell' && (t >= next.weaponUntil || next.weaponAmmo <= 0))
      next = { ...next, weapon: 'shell', weaponAmmo: 0, weaponUntil: 0 };
    next.angle = angleDelta(next.angle + (next.turn * OMEGA * STEP_MS) / 1000);
    const dx = (Math.cos(next.angle) * next.drive * SPEED * STEP_MS) / 1000;
    const dy = (Math.sin(next.angle) * next.drive * SPEED * STEP_MS) / 1000;
    const walls = nearby(buckets, world.maze, next);
    if (clear(walls, next.x + dx, next.y + dy, TANK_RADIUS)) {
      next.x += dx;
      next.y += dy;
    } else {
      if (clear(walls, next.x + dx, next.y, TANK_RADIUS)) next.x += dx;
      if (clear(walls, next.x, next.y + dy, TANK_RADIUS)) next.y += dy;
    }
    next.x = round(next.x);
    next.y = round(next.y);
    next.angle = round(next.angle);
    return next;
  });
  const blocked = new Set<number>();
  // A reverted body can block a following body too. Propagate stops simultaneously until stable.
  for (let pass = 0; pass < tanks.length; pass++) {
    const before = blocked.size;
    for (let a = 0; a < tanks.length; a++)
      for (let b = a + 1; b < tanks.length; b++)
        if (
          tanks[a]!.alive &&
          tanks[b]!.alive &&
          sq(tanks[a]!, tanks[b]!) < (TANK_RADIUS * 2) ** 2
        ) {
          blocked.add(a);
          blocked.add(b);
        }
    tanks = tanks.map((tank, i) =>
      blocked.has(i) ? { ...tank, x: world.tanks[i]!.x, y: world.tanks[i]!.y } : tank,
    );
    if (blocked.size === before) break;
  }
  let bullets = [...world.bullets];
  let nextBullet = world.nextBullet;
  tanks = tanks.map((tank) => {
    if (!tank.alive || !tank.fire || t < tank.reloadAt || t < world.safeUntil) return tank;
    const count = bullets.filter((b) => b.owner === tank.id).length;
    const angles = tank.weapon === 'scatter' ? [-0.2, 0, 0.2] : [0];
    if (count + angles.length > MAX_SHELLS) return tank;
    const kind = tank.weapon;
    const speed = kind === 'beam' ? 130 : kind === 'guided' ? 34 : SHELL_SPEED;
    let fired = false;
    for (const offset of angles) {
      const angle = tank.angle + offset;
      const muzzle = {
        x: tank.x + Math.cos(angle) * (TANK_RADIUS + SHELL_RADIUS + 0.15),
        y: tank.y + Math.sin(angle) * (TANK_RADIUS + SHELL_RADIUS + 0.15),
      };
      // A barrel pointed into a wall cannot put a shell on its far side.
      if (
        !canOccupy(world.maze, muzzle.x, muzzle.y, SHELL_RADIUS) ||
        firstWall(
          nearby(buckets, world.maze, tank),
          tank,
          { x: muzzle.x - tank.x, y: muzzle.y - tank.y },
          SHELL_RADIUS,
        )
      )
        continue;
      bullets.push({
        id: nextBullet++,
        owner: tank.id,
        ...muzzle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        born: t,
        bounces: 0,
        kind,
      });
      fired = true;
    }
    if (!fired) return tank;
    return {
      ...tank,
      reloadAt: t + (kind === 'scatter' ? 700 : RELOAD_MS),
      weaponAmmo: kind === 'shell' ? 0 : Math.max(0, tank.weaponAmmo - 1),
    };
  });
  const dead = new Set<string>();
  const advanced: Bullet[] = [];
  for (const bullet of bullets) {
    const result = moveBullet(bullet, tanks, world.maze, buckets, t, world.safeUntil);
    if (result.bullet) advanced.push(result.bullet);
    for (const id of result.hits) dead.add(id);
  }
  tanks = tanks.map((tank) =>
    dead.has(tank.id)
      ? { ...tank, alive: false, died: t, drive: 0, turn: 0, fire: false, inputUntil: 0 }
      : tank,
  );
  const pickups: Pickup[] = [];
  for (const pickup of world.pickups) {
    const candidates = tanks
      .map((tank, i) => ({ i, d: sq(tank, pickup) }))
      .filter(({ i, d }) => tanks[i]!.alive && d < (TANK_RADIUS + 1.3) ** 2)
      .sort((a, b) => a.d - b.d);
    // Exact contested pickups stay on the board; no seat-order advantage.
    if (!candidates[0] || (candidates[1] && Math.abs(candidates[0].d - candidates[1].d) < 1e-8)) {
      pickups.push(pickup);
      continue;
    }
    const i = candidates[0].i;
    tanks[i] = {
      ...tanks[i]!,
      weapon: pickup.kind,
      weaponAmmo: pickup.kind === 'scatter' ? 2 : 1,
      weaponUntil: t + 12_000,
    };
  }
  tanks = tanks.map((tank) => ({
    ...tank,
    ammo:
      tank.weapon === 'shell'
        ? Math.max(0, MAX_SHELLS - advanced.filter((b) => b.owner === tank.id).length)
        : tank.weaponAmmo,
  }));
  return { ...world, tanks, bullets: advanced, pickups, nextBullet, stepped: t / STEP_MS };
}

/** Catch-up is partition invariant; the first completed final-death sample locks the round. */
export function tick(world: World, to: number): World {
  const last = Math.floor(Math.max(0, Math.min(ROUND_MS, to)) / STEP_MS);
  if (last <= world.stepped || finished(world)) return world;
  const buckets = wallBuckets(world.maze);
  let next = world;
  for (let k = world.stepped + 1; k <= last; k++) {
    next = step(next, k * STEP_MS, buckets);
    if (finished(next)) break;
  }
  return next;
}

/** Controls latch after the completed sample; equal-time players do not shoot in receive order. */
export function apply(world: World, id: string, input: Input, t: number): World {
  if (t < world.stepped * STEP_MS || !inputSchema.safeParse(input).success) return world;
  const i = world.tanks.findIndex((tank) => tank.id === id && tank.alive);
  const tank = world.tanks[i];
  if (!tank || t < tank.controlAt) return world;
  const next = {
    ...tank,
    drive: input.drive || 0,
    turn: input.turn || 0,
    fire: input.fire,
    controlAt: world.stepped * STEP_MS,
    inputUntil: t + INPUT_LEASE_MS,
  };
  return { ...world, tanks: world.tanks.map((old, at) => (at === i ? next : old)) };
}

export function stopTank(world: World, id: string, gone = false): World {
  return {
    ...world,
    tanks: world.tanks.map((tank) =>
      tank.id === id
        ? {
            ...tank,
            drive: 0,
            turn: 0,
            fire: false,
            inputUntil: 0,
            ...(gone && tank.alive ? { alive: false, died: world.stepped * STEP_MS } : {}),
          }
        : tank,
    ),
  };
}
