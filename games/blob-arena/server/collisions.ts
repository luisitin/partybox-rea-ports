// Resolve collisions in cell-id order, so ties never depend on object iteration.
import { clampCell, distance, radius } from './geometry';
import { EAT_RATIO } from './types';
import type { Cell } from './types';

export function resolveCells(source: Cell[], time: number): Cell[] {
  const cells = source.map((c) => ({ ...c })).sort((a, b) => a.id - b.id);
  const removed = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    const a = cells[i]!;
    if (removed.has(a.id)) continue;
    for (let j = i + 1; j < cells.length; j++) {
      const b = cells[j]!;
      if (removed.has(b.id)) continue;
      const d = distance(a, b);
      const ra = radius(a.mass),
        rb = radius(b.mass);
      if (a.owner === b.owner) {
        if (time >= Math.max(a.mergeAt, b.mergeAt) && d < ra + rb) {
          const mass = a.mass + b.mass;
          a.x = (a.x * a.mass + b.x * b.mass) / mass;
          a.y = (a.y * a.mass + b.y * b.mass) / mass;
          a.mass = mass;
          a.vx = 0;
          a.vy = 0;
          a.shieldUntil = Math.max(a.shieldUntil, b.shieldUntil);
          removed.add(b.id);
        } else if (d < ra + rb && d > 0) {
          const push = (ra + rb - d) / 2;
          const dx = (a.x - b.x) / d,
            dy = (a.y - b.y) / d;
          a.x += dx * push;
          a.y += dy * push;
          b.x -= dx * push;
          b.y -= dy * push;
        }
        continue;
      }
      if (time < a.shieldUntil || time < b.shieldUntil) continue;
      const big = a.mass >= b.mass ? a : b;
      const small = big === a ? b : a;
      if (big.mass >= small.mass * EAT_RATIO && d < radius(big.mass) - radius(small.mass) * 0.35) {
        big.mass += small.mass;
        removed.add(small.id);
        if (small === a) break;
      }
    }
  }
  return cells.filter((c) => !removed.has(c.id)).map(clampCell);
}
