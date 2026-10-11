// Shared presentation helpers keep the TV lanes and phone standings in the same seat order.
import type { CSSProperties } from 'react';
import type { Climber } from '../server/types';

export interface ClimbRow {
  id: string;
  slot: number;
  name: string;
  height: number;
  total: number;
  gained: number;
  out: boolean;
}

interface RowSource {
  players: { id: string; name: string }[];
  climbers: Climber[];
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
}

export function climbRows(view: RowSource, ranked = false): ClimbRow[] {
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const rows = view.climbers.map((c, slot) => ({
    id: c.id,
    slot,
    name: names.get(c.id) ?? '',
    height: Math.floor(c.peak),
    total: view.scores[c.id] ?? 0,
    gained: view.lastPoints[c.id] ?? 0,
    out: c.died !== null,
  }));
  return ranked ? [...rows].sort((a, b) => b.total - a.total || a.slot - b.slot) : rows;
}

export function playerStyle(slot: number): CSSProperties {
  return { ['--climber-color' as string]: `var(--pb-player-${(slot % 8) + 1})` };
}

export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
