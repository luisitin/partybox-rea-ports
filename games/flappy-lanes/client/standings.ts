import { compareCodeUnits } from '@partybox/game-sdk';
import type { Bird } from '../server/world';

interface RowSource {
  players: { id: string; name: string; status?: string }[];
  birds?: Bird[];
  mine?: Bird | null;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
}

export interface StandingRow {
  id: string;
  slot: number;
  name: string;
  total: number;
  gained: number;
  passed: number;
  out: boolean;
  me: boolean;
}

export function standingsRows(view: RowSource, meId = '', ranked = false): StandingRow[] {
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const order =
    view.birds ??
    [...view.players]
      .sort((a, b) => compareCodeUnits(a.id, b.id))
      .map((p) =>
        view.mine?.id === p.id
          ? view.mine
          : { id: p.id, died: p.status === 'waiting' ? 0 : null, passed: 0 },
      );
  const rows = order.map((bird, slot) => ({
    id: bird.id,
    slot,
    name: names.get(bird.id) ?? '',
    total: view.scores[bird.id] ?? 0,
    gained: view.lastPoints[bird.id] ?? 0,
    passed: bird.passed,
    out: bird.died !== null,
    me: bird.id === meId,
  }));
  return ranked ? [...rows].sort((a, b) => b.total - a.total || a.slot - b.slot) : rows;
}
