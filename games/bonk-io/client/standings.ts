export interface StandingRow {
  id: string;
  slot: number;
  name: string;
  total: number;
  gained: number;
  rank: number;
  tied: boolean;
  alive: boolean;
  heavy: boolean;
  departed: boolean;
  connected: boolean;
  me: boolean;
}

interface Source {
  players: readonly { id: string; name: string; connected: boolean }[];
  balls?: readonly {
    id: string;
    slot: number;
    alive: boolean;
    heavy: boolean;
    cause: string | null;
  }[];
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
}

/** Stable slot order while playing; competition ranks (1, 1, 3) between rounds. */
export function standingsRows(view: Source, me = '', ranked = false): StandingRow[] {
  const roster = new Map(view.players.map((player) => [player.id, player]));
  const balls =
    view.balls ??
    view.players.map((player, slot) => ({
      id: player.id,
      slot,
      alive: true,
      heavy: false,
      cause: null,
    }));
  const rows: StandingRow[] = balls.map((ball) => ({
    id: ball.id,
    slot: ball.slot,
    name: roster.get(ball.id)?.name ?? `Player ${ball.slot + 1}`,
    total: view.scores[ball.id] ?? 0,
    gained: view.lastPoints[ball.id] ?? 0,
    rank: 1,
    tied: false,
    alive: ball.alive,
    heavy: ball.heavy,
    departed: ball.cause === 'left',
    connected: roster.get(ball.id)?.connected ?? false,
    me: ball.id === me,
  }));
  const ordered = [...rows].sort((a, b) => b.total - a.total || a.slot - b.slot);
  for (const row of rows) {
    row.rank = ordered.findIndex((item) => item.total === row.total) + 1;
    row.tied = rows.filter((item) => item.total === row.total).length > 1;
  }
  return ranked ? ordered : rows.sort((a, b) => a.slot - b.slot);
}

export const playerStyle = (slot: number): Record<string, string> => ({
  '--ball-color': `var(--pb-player-${Math.max(1, Math.min(8, slot + 1))})`,
});

export const secondsLeft = (deadline: number | null, now: number): number =>
  deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));

export const clockText = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
