// Presentation-only geometry and labels; the server owns all eligibility and scoring.
import type { CSSProperties } from 'react';
import type { CityView, HoleView, PropKind } from '../server/types';

export const CITY_WIDTH = 180;
export const CITY_HEIGHT = 110;
export const PROP_ART_EXTENT: Readonly<Record<PropKind, number>> = {
  bin: 1.4,
  tree: 2,
  bench: 3,
  car: 4.6,
  house: 7,
  tower: 10,
};
export const TARGETS: readonly { kind: PropKind; label: string; radius: number }[] = [
  { kind: 'bin', label: 'Bins', radius: 1 },
  { kind: 'tree', label: 'Trees', radius: 1.7 },
  { kind: 'bench', label: 'Benches', radius: 2.6 },
  { kind: 'car', label: 'Cars', radius: 4.2 },
  { kind: 'house', label: 'Houses', radius: 7 },
  { kind: 'tower', label: 'Towers', radius: 10 },
];

export const playerStyle = (slot: number): CSSProperties => ({
  ['--pb-hole-color' as string]: `var(--pb-player-${(Math.max(0, slot) % 8) + 1})`,
});

export const clockText = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function targetsFor(radius: number): { current: string; next: string | null } {
  const edible = TARGETS.filter((t) => t.radius < radius);
  return {
    current: edible.at(-1)?.label ?? 'Bins',
    next: TARGETS.find((t) => t.radius >= radius)?.label ?? null,
  };
}

export interface Standing {
  hole: HoleView;
  name: string;
  connected: boolean;
  rank: number;
}

export function standings(
  city: CityView | undefined,
  players: readonly { id: string; name: string; connected: boolean }[],
  scores: Readonly<Record<string, number>> = {},
  slots: Readonly<Record<string, number>> = {},
): Standing[] {
  const rows = players
    .map((p, slot) => ({
      hole: city?.holes.find((h) => h.id === p.id) ?? {
        id: p.id,
        slot: slots[p.id] ?? slot,
        x: 0,
        y: 0,
        radius: 0,
        alive: false,
        level: 1,
        growth: 0,
        levelProgress: 0,
        nextLevelAt: null,
        eliminatedAt: null,
        eliminatedBy: null,
        connected: p.connected,
        left: false,
        score: scores[p.id] ?? 0,
        swallowed: 0,
        respawnIn: 0,
        shield: false,
        lastGain: 0,
      },
      name: p.name,
      connected: p.connected,
      rank: 1,
    }))
    .sort((a, b) => b.hole.score - a.hole.score || a.hole.slot - b.hole.slot);
  return rows.map((row) => ({
    ...row,
    rank: 1 + rows.filter((other) => other.hole.score > row.hole.score).length,
  }));
}

export function winnerLine(rows: readonly Standing[]): string {
  if (rows.length === 0) return 'City cleared';
  const leaders = rows.filter((r) => r.rank === 1);
  return leaders.length === 1 ? `${leaders[0]?.name ?? ''} wins!` : 'A tie at the top!';
}

/** Labels live above every rim; nearby centers spread into numbered callouts instead of hiding. */
export function holeLabels(holes: readonly HoleView[]): {
  hole: HoleView;
  x: number;
  y: number;
  callout: boolean;
}[] {
  const clampX = (x: number): number => Math.max(4, Math.min(CITY_WIDTH - 4, x));
  const clampY = (y: number): number => Math.max(5, Math.min(CITY_HEIGHT - 5, y));
  const labels = holes.map((hole) => {
    const callout = holes.some(
      (other) => other.id !== hole.id && Math.hypot(other.x - hole.x, other.y - hole.y) < 9,
    );
    const angle = (hole.slot * Math.PI) / 4 - Math.PI / 2;
    const reach = callout ? Math.max(10, hole.radius * 0.6) : 0;
    return {
      hole,
      callout,
      x: clampX(hole.x + Math.cos(angle) * reach),
      y: clampY(hole.y + Math.sin(angle) * reach),
    };
  });
  // At most eight labels. Fixed bounded passes separate callouts without changing world physics.
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!,
          b = labels[j]!;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= 7.4) continue;
        const angle = ((a.hole.slot + b.hole.slot + 1) * Math.PI) / 4;
        const ux = distance > 0.0001 ? dx / distance : Math.cos(angle);
        const uy = distance > 0.0001 ? dy / distance : Math.sin(angle);
        const push = (7.4 - distance) / 2 + 0.01;
        a.x = clampX(a.x - ux * push);
        a.y = clampY(a.y - uy * push);
        b.x = clampX(b.x + ux * push);
        b.y = clampY(b.y + uy * push);
        a.callout = true;
        b.callout = true;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return labels;
}

/** Only surviving participants receive a camera; disconnection does not erase their hole. */
export function liveStandings(rows: readonly Standing[]): Standing[] {
  return rows.filter((row) => row.hole.alive !== false && !row.hole.left);
}

/** A watcher follows the highest-scoring connected survivor, then an away survivor. */
export function watchingLeader(rows: readonly Standing[]): Standing | undefined {
  const live = liveStandings(rows);
  return live.find((row) => row.connected) ?? live[0];
}
