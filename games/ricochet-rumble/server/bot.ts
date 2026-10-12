// Bots navigate the same public passage graph and aim/dodge using the public shells.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import {
  BOT_BEAT_MS,
  H,
  OMEGA,
  SHELL_SPEED,
  SPEED,
  TANK_RADIUS,
  W,
  angleDelta,
  canOccupy,
  cellCenter,
  mazeCell,
  mazeNeighbors,
  traceShell,
} from './world';
import type { Input, Point, Tank, World } from './world';

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const u = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-8, dx * dx + dy * dy)),
  );
  return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy);
}

/** Shortest reachable route, instead of driving at a rival through maze walls. */
export function route(world: World, from: Point, goal: Point): number[] {
  const start = mazeCell(world.maze, from);
  const target = mazeCell(world.maze, goal);
  const queue = [start];
  const previous = new Map<number, number>([[start, -1]]);
  for (let i = 0; i < queue.length && !previous.has(target); i++) {
    for (const n of mazeNeighbors(world.maze, queue[i]!)) {
      if (previous.has(n)) continue;
      previous.set(n, queue[i]!);
      queue.push(n);
    }
  }
  if (!previous.has(target)) return [];
  const out = [target];
  while (out[0] !== start) out.unshift(previous.get(out[0]!)!);
  return out;
}

/** Check the first body along each ricochet. A return to the owner is unsafe, even if it misses now. */
export function shotTarget(world: World, me: Tank, angle: number): string | null {
  const mouth = {
    x: me.x + Math.cos(angle) * (TANK_RADIUS + 0.8),
    y: me.y + Math.sin(angle) * (TANK_RADIUS + 0.8),
  };
  if (!canOccupy(world.maze, mouth.x, mouth.y, 0.65)) return null;
  const segments = traceShell(world.maze, mouth, angle, SHELL_SPEED * 2.5, me.weapon !== 'beam');
  let hit: string | null = null;
  let traveled = 0;
  for (const segment of segments) {
    const a = { x: segment.x1, y: segment.y1 };
    const b = { x: segment.x2, y: segment.y2 };
    const length = distance(a, b);
    let first = Infinity;
    for (const tank of world.tanks) {
      if (!tank.alive || (tank.id === me.id && traveled < 4)) continue;
      if (segmentDistance(tank, a, b) > TANK_RADIUS + 0.65) continue;
      const along = distance(tank, a);
      if (along < first) {
        first = along;
        hit = tank.id;
      }
    }
    if (hit) return hit === me.id ? null : hit;
    traveled += length;
  }
  return null;
}

/** Three actual strengths: route/aim precision, bank shots and projectile lookahead vary. */
export function botInput(
  world: World,
  id: string,
  checked: number,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  const me = world.tanks.find((tank) => tank.id === id);
  if (!me?.alive || checked - me.controlAt < BOT_BEAT_MS) return null;
  const opponents = world.tanks.filter((tank) => tank.alive && tank.id !== id);
  if (!opponents.length) return null;
  const routes = opponents
    .map((tank) => ({ tank, path: route(world, me, tank) }))
    .filter(({ path }) => path.length > 0)
    .sort((a, b) => a.path.length - b.path.length || distance(me, a.tank) - distance(me, b.tank));
  const target = routes[0];
  if (!target) return { type: 'control', drive: 0, turn: 0, fire: false };
  let path = target.path;
  let goal: Point = target.tank;
  if (me.weapon === 'shell' && skill !== 'easy') {
    const pickup = world.pickups
      .map((p) => ({ p, path: route(world, me, p) }))
      .filter(({ path: p }) => p.length > 0)
      .sort((a, b) => a.path.length - b.path.length)[0];
    if (pickup && pickup.path.length + 1 < path.length) {
      path = pickup.path;
      goal = pickup.p;
    }
  }
  let waypoint = path.length > 1 ? cellCenter(world.maze, path[1]!) : goal;
  // First return to our cell's middle if a diagonal shortcut would clip a doorway corner.
  if (path.length > 1) {
    const here = cellCenter(world.maze, path[0]!);
    const dx = waypoint.x - me.x;
    const dy = waypoint.y - me.y;
    const length = Math.hypot(dx, dy);
    if (
      !canOccupy(
        world.maze,
        me.x + (dx / Math.max(1, length)) * 5,
        me.y + (dy / Math.max(1, length)) * 5,
      )
    )
      waypoint = here;
  }
  let wanted = Math.atan2(waypoint.y - me.y, waypoint.x - me.x);
  if (skill === 'sharp') {
    const enemy = target.tank;
    const aimPoints = [
      enemy,
      { x: -enemy.x, y: enemy.y },
      { x: 2 * W - enemy.x, y: enemy.y },
      { x: enemy.x, y: -enemy.y },
      { x: enemy.x, y: 2 * H - enemy.y },
    ];
    for (const p of aimPoints) {
      const angle = Math.atan2(p.y - me.y, p.x - me.x);
      if (Math.abs(angleDelta(angle - me.angle)) < 0.8 && shotTarget(world, me, angle)) {
        wanted = angle;
        break;
      }
    }
  }
  if (skill === 'easy') wanted += (rng.float() - 0.5) * 0.22;
  const delta = angleDelta(wanted - me.angle);
  let drive = Math.abs(delta) < (skill === 'easy' ? 0.55 : 0.95) ? 1 : 0;
  let turn = Math.max(-1, Math.min(1, delta / ((OMEGA * BOT_BEAT_MS) / 1000)));
  const horizon = skill === 'sharp' ? 0.9 : skill === 'normal' ? 0.6 : 0.25;
  const dangers = world.bullets
    .filter((b) => b.owner !== me.id || checked - b.born >= 100)
    .map((b) =>
      traceShell(
        world.maze,
        b,
        Math.atan2(b.vy, b.vx),
        Math.hypot(b.vx, b.vy) * horizon,
        b.kind !== 'beam',
      ),
    );
  const dangerAt = (p: Point): number => {
    let nearest = Infinity;
    for (const danger of dangers)
      for (const segment of danger)
        nearest = Math.min(
          nearest,
          segmentDistance(p, { x: segment.x1, y: segment.y1 }, { x: segment.x2, y: segment.y2 }),
        );
    return nearest;
  };
  if (dangerAt(me) < TANK_RADIUS + 2) {
    let best = -Infinity;
    for (const choice of [-1, 0, 1]) {
      const a = me.angle + turn * OMEGA * horizon * 0.5;
      const p = {
        x: me.x + Math.cos(a) * choice * SPEED * horizon,
        y: me.y + Math.sin(a) * choice * SPEED * horizon,
      };
      if (!canOccupy(world.maze, p.x, p.y)) continue;
      const score = dangerAt(p) - distance(p, waypoint) * 0.005;
      if (score > best) {
        best = score;
        drive = choice;
      }
    }
    if (drive === 0 && skill === 'sharp') turn = Math.abs(turn) < 0.2 ? 0.8 : turn;
  }
  const aimed = shotTarget(world, me, me.angle);
  const fire = aimed !== null && (skill !== 'easy' || rng.chance(0.65));
  return { type: 'control', drive: drive || 0, turn: Math.round(turn * 1000) / 1000 || 0, fire };
}
