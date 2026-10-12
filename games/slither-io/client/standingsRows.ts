// Preserve snake numbers while ranking the score rows; colours never change with rank.
import type { World } from '../server/types';

interface Source {
  players: readonly { id: string; name: string; connected: boolean }[];
  snakeIds?: readonly string[];
  world?: World;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
}

export interface StandingRow {
  id: string;
  slot: number;
  name: string;
  connected: boolean;
  mass: number;
  total: number;
  gained: number;
  respawnIn: number;
  boost: boolean;
  protected: boolean;
}

export function standingsRows(view: Source, ranked: boolean): StandingRow[] {
  const names = new Map(view.players.map((player) => [player.id, player]));
  const order = view.world?.snakes ?? view.snakeIds?.map((id) => ({ id })) ?? view.players;
  const rows = order.map((snake, slot): StandingRow => {
    const active = view.world?.snakes.find((candidate) => candidate.id === snake.id);
    return {
      id: snake.id,
      slot,
      name: names.get(snake.id)?.name ?? '',
      connected: names.get(snake.id)?.connected ?? false,
      mass: Math.floor(active?.mass ?? 0),
      total: view.scores[snake.id] ?? 0,
      gained: view.lastPoints[snake.id] ?? 0,
      respawnIn:
        active?.respawnAt === null || active?.respawnAt === undefined
          ? 0
          : Math.max(1, Math.ceil((active.respawnAt - (view.world?.elapsed ?? 0)) / 1000)),
      boost: active?.boost ?? false,
      protected: (active?.safeUntil ?? 0) > (view.world?.elapsed ?? 0),
    };
  });
  return ranked ? rows.sort((a, b) => b.total - a.total || a.slot - b.slot) : rows;
}
