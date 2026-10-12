// Continuous steering: score collision-free paths, keeping clear of walls, trails and moving heads.
import { COLLIDE, H, SELF_SAFE, STEP_MS, W, inGap, posAt, segPos } from './world';
import type { Input, Seg, World } from './world';

const CELL = 5;
const LOOK_MS = 2000;
type Point = { x: number; y: number };
const key = (x: number, y: number): number => x * 4096 + y;

function trails(world: World, t: number): Map<number, (Point & { w: number; t: number })[]> {
  const grid = new Map<number, (Point & { w: number; t: number })[]>();
  world.worms.forEach((worm, w) => {
    const end = Math.min(t, worm.died === null ? t : worm.died - STEP_MS);
    for (let ms = 0; ms <= end; ms += STEP_MS * 2) {
      if (inGap(worm, ms)) continue;
      const p = posAt(worm, ms);
      const cell = key(Math.floor(p.x / CELL), Math.floor(p.y / CELL));
      const bucket = grid.get(cell) ?? [];
      bucket.push({ ...p, w, t: ms });
      grid.set(cell, bucket);
    }
  });
  return grid;
}

export function botInput(world: World, id: string, t: number): Input | null {
  const me = world.worms.findIndex((w) => w.id === id);
  const worm = world.worms[me];
  if (!worm || worm.died !== null) return null;
  // Reconsider after time advances, rather than oscillating twice at one checked instant.
  if (worm.segs.length > 1 && worm.segs.at(-1)?.[0] === t) return null;
  const here = posAt(worm, t);
  const current = worm.segs.at(-1)?.[4] ?? 0;
  const grid = trails(world, t);
  const others = world.worms.filter((w) => w.id !== id && w.died === null);
  const score = (dir: number): number => {
    const seg: Seg = [t, here.x, here.y, here.a, dir];
    let clearance = 0;
    for (let dt = STEP_MS; dt <= LOOK_MS; dt += STEP_MS) {
      const p = segPos(seg, t + dt);
      const margin = Math.min(p.x, W - p.x, p.y, H - p.y);
      let space = Math.min(12, margin);
      let hit = margin < 2.5;
      const cx = Math.floor(p.x / CELL);
      const cy = Math.floor(p.y / CELL);
      for (let dx = -1; dx <= 1 && !hit; dx++) {
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (const s of grid.get(key(cx + dx, cy + dy)) ?? []) {
            if (s.w === me && t + dt - s.t < SELF_SAFE * STEP_MS) continue;
            const distance = Math.hypot(s.x - p.x, s.y - p.y);
            space = Math.min(space, distance - COLLIDE);
            if (distance < COLLIDE + 1.3) {
              hit = true;
              break;
            }
          }
        }
      }
      if (!hit && dt <= 600)
        hit = others.some((w) => {
          const o = posAt(w, t + dt);
          return (o.x - p.x) ** 2 + (o.y - p.y) ** 2 < 16;
        });
      if (hit) return dt + clearance / 100;
      clearance += space;
    }
    // Prefer open straight routes over circling into our own newly laid trail.
    return LOOK_MS + clearance / 100 + (dir === 0 ? 50 : 0);
  };
  let best = current;
  let bestScore = score(current);
  for (const dir of [0, -1, 1]) {
    const candidate = score(dir) - (dir === current ? 0 : 2);
    if (candidate > bestScore) {
      best = dir;
      bestScore = candidate;
    }
  }
  return best === current ? null : { type: 'steer', dir: best };
}
