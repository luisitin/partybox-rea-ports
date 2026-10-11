import type { CSSProperties } from 'react';

interface StandingSource {
  players: { id: string; name: string }[];
  world: {
    paddles: {
      id: string;
      slot: number;
      lives: number;
      saves: number;
      eliminatedAt: number | null;
    }[];
  };
  scores: Record<string, number>;
}

export interface StandingRow {
  id: string;
  name: string;
  slot: number;
  lives: number;
  saves: number;
  score: number;
  out: boolean;
  me: boolean;
}

/** The same numbered edge has the same design-system player colour on every device. */
export const slotStyle = (slot: number): CSSProperties => ({
  ['--slot-color' as string]: `var(--pb-player-${(((slot % 8) + 8) % 8) + 1})`,
});

/** Keep the playing roster in edge order; only sort it once the result has been judged. */
export function standingsRows(view: StandingSource, meId = '', ranked = false): StandingRow[] {
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const rows = view.world.paddles.map((p): StandingRow => ({
    id: p.id,
    name: names.get(p.id) ?? '',
    slot: p.slot,
    lives: p.lives,
    saves: p.saves,
    score: view.scores[p.id] ?? 0,
    out: p.eliminatedAt !== null,
    me: p.id === meId,
  }));
  return ranked ? [...rows].sort((a, b) => b.score - a.score || a.slot - b.slot) : rows;
}

export function clockText(msLeft: number): string {
  const seconds = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
