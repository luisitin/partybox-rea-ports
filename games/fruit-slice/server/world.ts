// Seeded waves and continuous segment/circle intersection; no client-supplied hits or points.
import { nextInt, z } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { WAVE_MS } from './types';
import type { Fruit, Point, Target } from './types';

const point = z.object({
  x: z.number().finite().min(0).max(100),
  y: z.number().finite().min(0).max(100),
});
export const inputSchema = z.object({
  type: z.literal('slice'),
  wave: z.number().int().min(0).max(29),
  frame: z.number().int().min(0).max(60_000),
  seq: z.number().int().min(0).max(1_000_000),
  points: z.array(point).min(2).max(32),
});

export function makeWave(rng: RngState, wave: number): [Fruit[], RngState] {
  let r = rng;
  const fruit: Fruit[] = [];
  let count: number, offset: number, peak: number;
  [count, r] = nextInt(r, 3, 5);
  [offset, r] = nextInt(r, -6, 6);
  [peak, r] = nextInt(r, 20, 40);
  for (let i = 0; i < count; i++) {
    let kind: number, drift: number;
    [kind, r] = nextInt(r, 0, 3);
    [drift, r] = nextInt(r, -4, 4);
    fruit.push({ id: i, kind, x: 18 + (64 * i) / (count - 1) + offset, drift, peak, bomb: false });
  }
  // A clearly separated bomb every second wave, after one safe wave to discover the gesture.
  if (wave % 2 === 1) {
    let x: number;
    [x, r] = nextInt(r, 25, 75);
    fruit.push({ id: count, kind: 4, x, drift: 0, peak: peak + 22, bomb: true });
  }
  return [fruit, r];
}

export function targetsAt(fruit: Fruit[], frame: number, wave: number): Target[] {
  const t = Math.min(1, Math.max(0, (frame - wave * WAVE_MS) / WAVE_MS));
  return fruit.map((f) => ({
    id: f.id,
    kind: f.kind,
    bomb: f.bomb,
    x: Math.round((f.x + f.drift * t) * 100) / 100,
    y: Math.round((92 - (92 - f.peak) * 4 * t * (1 - t)) * 100) / 100,
    radius: 7,
  }));
}

export function crosses(points: Point[], target: Target): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    if (length < 0.01) continue;
    const t = Math.max(0, Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / length));
    if ((a.x + t * dx - target.x) ** 2 + (a.y + t * dy - target.y) ** 2 <= target.radius ** 2)
      return true;
  }
  return false;
}
