// Survival outranks block points. Equal survival and points share a finite rank.
import { compareCodeUnits } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { Board, Standing, State } from './types';

function compare(a: Board, b: Board): number {
  if (a.alive !== b.alive) return a.alive ? -1 : 1;
  if (!a.alive && a.diedAt !== b.diedAt) return (b.diedAt ?? 0) - (a.diedAt ?? 0);
  return b.score - a.score;
}
export function standings(state: State): Standing[] {
  const boards = [...state.boards].sort((a, b) => compare(a, b) || compareCodeUnits(a.id, b.id));
  return boards.map((board) => ({
    id: board.id,
    name: state.players[board.id]?.name ?? '',
    score: board.score,
    lines: board.lines,
    survivedMs: Math.max(0, Math.min(state.endsAt, board.diedAt ?? state.checked) - state.began),
    alive: board.alive,
    rank: 1 + boards.filter((other) => compare(other, board) < 0).length,
  }));
}
export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  const rows = standings(state);
  return {
    scores: Object.fromEntries(rows.map((row) => [row.id, row.score])),
    ranking: rows.map((row) => ({ playerId: row.id, score: row.score, rank: row.rank })),
    winnerIds: rows.filter((row) => row.rank === 1).map((row) => row.id),
    awards: [],
  };
}
