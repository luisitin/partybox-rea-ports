// Fixed 20 ms collision samples make replay and chunked timer delivery identical.
import { BOUNCE, GRAVITY, SPEED, SPRING, STEP_MS, W } from './types';
import type { Climber, Input, Platform, World } from './types';

export const wrap = (x: number): number => ((x % W) + W) % W;
export const deltaX = (from: number, to: number): number => wrap(to - from + W / 2) - W / 2;
const rounded = (n: number): number => Math.round(n * 10000) / 10000 || 0;

export function lands(x: number, platform: Platform): boolean {
  return Math.abs(deltaX(x, platform.x)) <= platform.width / 2 + 8;
}

export function lowerPlatform(platforms: Platform[], y: number): number {
  let lo = 0;
  let hi = platforms.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (platforms[mid]!.y < y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function visiblePlatforms(platforms: Platform[], camera: number): Platform[] {
  return platforms.slice(
    lowerPlatform(platforms, camera - 24),
    lowerPlatform(platforms, camera + 320 + 0.001),
  );
}

function step(climber: Climber, platforms: Platform[], elapsed: number): Climber {
  if (climber.died !== null) return climber;
  const dt = STEP_MS / 1000;
  const dx = climber.dir * SPEED * dt;
  const x = rounded(wrap(climber.x + dx));
  let vy = rounded(climber.vy - GRAVITY * dt);
  let y = rounded(climber.y + ((climber.vy + vy) * dt) / 2);
  let bounces = climber.bounces;
  if (vy < 0) {
    // Descending crossing, highest surface first; side edges are a continuous cylinder.
    for (let i = lowerPlatform(platforms, climber.y + 0.001) - 1; i >= 0; i--) {
      const p = platforms[i]!;
      if (p.y < y) break;
      const fraction = climber.y === y ? 1 : (climber.y - p.y) / (climber.y - y);
      if (!lands(wrap(climber.x + dx * fraction), p)) continue;
      y = p.y;
      vy = p.kind === 'spring' ? SPRING : BOUNCE;
      bounces++;
      break;
    }
  }
  const peak = Math.max(climber.peak, y);
  const camera = Math.max(0, peak - 180);
  return { ...climber, x, y, vy, peak, camera, bounces, died: y < camera - 24 ? elapsed : null };
}

export function tick(world: World, to: number): World {
  const last = Math.floor(Math.max(0, to) / STEP_MS);
  if (last <= world.stepped) return world;
  let climbers = world.climbers;
  for (let k = world.stepped + 1; k <= last; k++) {
    climbers = climbers.map((c) => step(c, world.platforms, k * STEP_MS));
    if (climbers.every((c) => c.died !== null)) return { ...world, climbers, stepped: k };
  }
  return { ...world, climbers, stepped: last };
}

export function apply(world: World, id: string, input: Input): World {
  const c = world.climbers.find((p) => p.id === id);
  if (!c || c.died !== null || c.dir === input.dir) return world;
  return {
    ...world,
    climbers: world.climbers.map((p) => (p.id === id ? { ...p, dir: input.dir } : p)),
  };
}
