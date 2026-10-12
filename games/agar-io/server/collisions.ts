// Merge siblings first, then settle all rival ownership from one shared frame snapshot.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { bound, clampCell, distance, radius } from './geometry';
import { EAT_RATIO, STEP_MS } from './types';
import type { Cell } from './types';

// Four-decimal positions can introduce negligible distance noise in a symmetric contact.
const PREDATOR_TIE_TOLERANCE = 0.001;

function separation(a: Cell, b: Cell, time: number, old: ReadonlyMap<number, Cell>): number {
  const pa = old.get(a.id),
    pb = old.get(b.id);
  // A shield expiring inside this step cannot retroactively grant an earlier swept catch.
  if (!pa || !pb || time - STEP_MS < Math.max(a.shieldUntil, b.shieldUntil)) return distance(a, b);
  const x = pa.x - pb.x,
    y = pa.y - pb.y;
  const dx = a.x - b.x - x,
    dy = a.y - b.y - y;
  const square = dx * dx + dy * dy;
  const along = square === 0 ? 0 : bound(-(x * dx + y * dy) / square, 0, 1);
  return Math.hypot(x + along * dx, y + along * dy);
}

export function resolveCells(
  source: Cell[],
  time: number,
  rng: RngState,
  previous: readonly Cell[] = [],
): [Cell[], RngState] {
  const cells = source.map((c) => ({ ...c })).sort((a, b) => a.id - b.id);
  const old = new Map(previous.map((c) => [c.id, c]));
  const removed = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    const a = cells[i]!;
    if (removed.has(a.id)) continue;
    for (let j = i + 1; j < cells.length; j++) {
      const b = cells[j]!;
      if (removed.has(b.id) || a.owner !== b.owner) continue;
      const d = distance(a, b);
      const ra = radius(a.mass),
        rb = radius(b.mass);
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
    }
  }
  const snapshot = cells.filter((c) => !removed.has(c.id));
  const parents = new Map<number, number>();
  let r = rng;
  for (const victim of snapshot) {
    if (time < victim.shieldUntil) continue;
    let nearest = Infinity;
    const candidates: { cell: Cell; gap: number }[] = [];
    for (const predator of snapshot) {
      if (
        predator.owner === victim.owner ||
        time < predator.shieldUntil ||
        predator.mass <= victim.mass ||
        predator.mass < victim.mass * EAT_RATIO
      )
        continue;
      const gap = separation(predator, victim, time, old);
      if (gap >= radius(predator.mass) - radius(victim.mass) * 0.35) continue;
      nearest = Math.min(nearest, gap);
      candidates.push({ cell: predator, gap });
    }
    if (!candidates.length) continue;
    const ties = candidates
      .filter(({ gap }) => gap - nearest <= PREDATOR_TIE_TOLERANCE)
      .sort((a, b) => a.cell.id - b.cell.id);
    let chosen = 0;
    if (ties.length > 1) [chosen, r] = nextInt(r, 0, ties.length - 1);
    parents.set(victim.id, ties[chosen]!.cell.id);
  }
  if (!parents.size) return [snapshot.map(clampCell), r];
  const masses = new Map(snapshot.map((c) => [c.id, c.mass]));
  for (const victim of snapshot) {
    let root = parents.get(victim.id);
    if (root === undefined) continue;
    // Every edge increases snapshot mass strictly, so the graph cannot cycle.
    while (parents.has(root)) root = parents.get(root)!;
    masses.set(root, masses.get(root)! + victim.mass);
  }
  return [
    snapshot
      .filter((c) => !parents.has(c.id))
      .map((c) => clampCell({ ...c, mass: masses.get(c.id)! })),
    r,
  ];
}
