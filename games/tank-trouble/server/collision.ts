import {
  OWNER_SAFE_MS,
  SHELL_MS,
  SHELL_RADIUS,
  STEP_MS,
  TANK_RADIUS,
  angleDelta,
  round,
  sq,
} from './world-core';
import type { Bullet, Maze, Point, Tank, Wall } from './world-core';

function pointSegmentSq(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const f = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-12, dx * dx + dy * dy)),
  );
  return (p.x - a.x - f * dx) ** 2 + (p.y - a.y - f * dy) ** 2;
}
export function clear(walls: Wall[], x: number, y: number, radius: number): boolean {
  const p = { x, y };
  return walls.every(
    (wall) =>
      pointSegmentSq(p, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }) >=
      radius * radius - 1e-8,
  );
}
export function canOccupy(maze: Maze, x: number, y: number, radius = TANK_RADIUS): boolean {
  return (
    x >= radius &&
    y >= radius &&
    x <= maze.cols * maze.cell - radius &&
    y <= maze.rows * maze.cell - radius &&
    clear(maze.walls, x, y, radius)
  );
}

interface WallHit {
  f: number;
  flipX: boolean;
  flipY: boolean;
}
/** Swept point against a radius-expanded wall. Earliest tied axes reflect together at a corner. */
export function firstWall(walls: Wall[], p: Point, delta: Point, radius: number): WallHit | null {
  let best: WallHit | null = null;
  for (const w of walls) {
    const bounds = [
      Math.min(w.x1, w.x2) - radius,
      Math.max(w.x1, w.x2) + radius,
      Math.min(w.y1, w.y2) - radius,
      Math.max(w.y1, w.y2) + radius,
    ];
    let lo = -Infinity;
    let hi = Infinity;
    let axis = 0;
    let miss = false;
    for (const [a, d, min, max, bit] of [
      [p.x, delta.x, bounds[0]!, bounds[1]!, 1],
      [p.y, delta.y, bounds[2]!, bounds[3]!, 2],
    ]) {
      if (Math.abs(d!) < 1e-12) {
        if (a! < min! || a! > max!) miss = true;
        continue;
      }
      const near = Math.min((min! - a!) / d!, (max! - a!) / d!);
      const far = Math.max((min! - a!) / d!, (max! - a!) / d!);
      if (near > lo + 1e-9) {
        lo = near;
        axis = bit!;
      } else if (Math.abs(near - lo) < 1e-9) axis |= bit!;
      hi = Math.min(hi, far);
    }
    if (miss || lo > hi || hi < 0 || lo < -1e-8 || lo > 1) continue;
    const f = Math.max(0, lo);
    if (!best || f < best.f - 1e-9) best = { f, flipX: !!(axis & 1), flipY: !!(axis & 2) };
    else if (Math.abs(f - best.f) < 1e-9) {
      best.flipX ||= !!(axis & 1);
      best.flipY ||= !!(axis & 2);
    }
  }
  return best;
}

/** Analytic ricochet preview, used by fair bots and rule tests. Never reads hidden state. */
export function traceShell(
  maze: Maze,
  from: Point,
  angle: number,
  distance: number,
  bounce = true,
): Wall[] {
  const segments: Wall[] = [];
  let p = from;
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  let left = Math.max(0, distance);
  for (let b = 0; b < 24 && left > 1e-6; b++) {
    const hit = firstWall(maze.walls, p, { x: dx * left, y: dy * left }, SHELL_RADIUS);
    const f = hit?.f ?? 1;
    const end = { x: p.x + dx * left * f, y: p.y + dy * left * f };
    segments.push({ x1: p.x, y1: p.y, x2: end.x, y2: end.y });
    if (!hit || !bounce) break;
    left *= 1 - f;
    if (hit.flipX) dx = -dx;
    if (hit.flipY) dy = -dy;
    p = { x: end.x + dx * 1e-5, y: end.y + dy * 1e-5 };
  }
  return segments;
}

// Build small wall buckets once per catch-up, not once per tank/shell/sample.
export function wallBuckets(maze: Maze): Map<number, Wall[]> {
  const out = new Map<number, Wall[]>();
  for (const w of maze.walls) {
    const x0 = Math.floor((Math.min(w.x1, w.x2) - TANK_RADIUS) / maze.cell);
    const x1 = Math.floor((Math.max(w.x1, w.x2) + TANK_RADIUS) / maze.cell);
    const y0 = Math.floor((Math.min(w.y1, w.y2) - TANK_RADIUS) / maze.cell);
    const y1 = Math.floor((Math.max(w.y1, w.y2) + TANK_RADIUS) / maze.cell);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const k = y * 100 + x;
        const list = out.get(k) ?? [];
        list.push(w);
        out.set(k, list);
      }
  }
  return out;
}
export function nearby(buckets: Map<number, Wall[]>, maze: Maze, p: Point): Wall[] {
  return buckets.get(Math.floor(p.y / maze.cell) * 100 + Math.floor(p.x / maze.cell)) ?? [];
}

/** Earliest contact fraction of a swept shell with a tank's circular body. */
function tankHit(p: Point, delta: Point, tank: Tank): number | null {
  const x = p.x - tank.x;
  const y = p.y - tank.y;
  const radius = TANK_RADIUS + SHELL_RADIUS;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = delta.x ** 2 + delta.y ** 2;
  const b = 2 * (x * delta.x + y * delta.y);
  const discriminant = b * b - 4 * a * c;
  if (a < 1e-12 || discriminant < 0) return null;
  const f = (-b - Math.sqrt(discriminant)) / (2 * a);
  return f >= 0 && f <= 1 ? f : null;
}

export function moveBullet(
  bullet: Bullet,
  tanks: Tank[],
  maze: Maze,
  buckets: Map<number, Wall[]>,
  t: number,
  safeUntil: number,
): { bullet: Bullet | null; hits: string[] } {
  if (t - bullet.born >= (bullet.kind === 'beam' ? 1000 : SHELL_MS))
    return { bullet: null, hits: [] };
  let b = { ...bullet };
  if (b.kind === 'guided' && t - b.born >= 250) {
    let nearest: Tank | undefined;
    for (const tank of tanks)
      if (tank.alive && tank.id !== b.owner && (!nearest || sq(tank, b) < sq(nearest, b)))
        nearest = tank;
    if (nearest) {
      const angle = Math.atan2(b.vy, b.vx);
      const delta = angleDelta(Math.atan2(nearest.y - b.y, nearest.x - b.x) - angle);
      const turned = angle + Math.max(-0.055, Math.min(0.055, delta));
      const speed = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(turned) * speed;
      b.vy = Math.sin(turned) * speed;
    }
  }
  let dt = STEP_MS / 1000;
  for (let bounce = 0; bounce < 4 && dt > 1e-8; bounce++) {
    const delta = { x: b.vx * dt, y: b.vy * dt };
    const walls = nearby(buckets, maze, b);
    const wall = firstWall(walls, b, delta, SHELL_RADIUS);
    const end = wall?.f ?? 1;
    let contact = Infinity;
    const hits: string[] = [];
    if (t >= safeUntil)
      for (const tank of tanks) {
        if (!tank.alive || (tank.id === b.owner && t - b.born < OWNER_SAFE_MS)) continue;
        const f = tankHit(b, delta, tank);
        if (f === null || f > end + 1e-9) continue;
        if (f < contact - 1e-9) {
          contact = f;
          hits.length = 0;
          hits.push(tank.id);
        } else if (Math.abs(f - contact) < 1e-9) hits.push(tank.id);
      }
    if (hits.length) return { bullet: null, hits };
    b.x += delta.x * end;
    b.y += delta.y * end;
    if (!wall) break;
    if (b.kind === 'beam') return { bullet: null, hits: [] };
    if (wall.flipX) b.vx = -b.vx;
    if (wall.flipY) b.vy = -b.vy;
    b.bounces++;
    b.x += Math.sign(b.vx) * 1e-5;
    b.y += Math.sign(b.vy) * 1e-5;
    dt *= 1 - end;
  }
  b.x = round(b.x);
  b.y = round(b.y);
  b.vx = round(b.vx);
  b.vy = round(b.vy);
  return { bullet: b, hits: [] };
}
