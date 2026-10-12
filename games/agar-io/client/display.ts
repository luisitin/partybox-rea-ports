// Public view formatting only. The server supplies all masses and awarded points.
import type { CSSProperties } from 'react';
import type { ViewPlayer } from '@partybox/game-sdk/ui';
import type { MatchView } from '../server/index';

export const playerStyle = (slot: number): CSSProperties => ({
  ['--blob-colour' as string]: `var(--pb-player-${(Math.max(0, slot) % 8) + 1})`,
});

export const clockText = (ms: number): string => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export interface Standing {
  id: string;
  name: string;
  slot: number;
  mass: number;
  gained: number;
  total: number;
  connected: boolean;
  departed: boolean;
  rank: number;
}

export function standings(
  view: MatchView & { players: ViewPlayer[] },
  ordered: boolean,
): Standing[] {
  const rows = view.players.map((p, index) => ({
    id: p.id,
    name: p.name,
    slot: view.slots[p.id] ?? index,
    mass: view.masses[p.id] ?? 0,
    gained: view.lastPoints[p.id] ?? 0,
    total: view.scores[p.id] ?? 0,
    connected: p.connected,
    departed: view.departedIds.includes(p.id),
    rank: 1 + Object.values(view.scores).filter((total) => total > (view.scores[p.id] ?? 0)).length,
  }));
  return rows.sort((a, b) => (ordered ? b.total - a.total : 0) || a.slot - b.slot);
}
