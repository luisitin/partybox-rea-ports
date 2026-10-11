// ADR-087: turns a game's `results()` into the minigame's ranking. Total: a game that ends oddly
// (no results, a missing player, a lost co-op) still ranks every player passed in.
import type { GameResults, MinigameMode, PlayerInfo } from '@partybox/shared';
import type { MinigameResult } from './types';

export interface ResultInput {
  gameId: string;
  mode: MinigameMode;
  players: readonly PlayerInfo[];
  teams: readonly (readonly string[])[];
  /** `manifest.minigame.teamScore === 'sum'`: the sides are decided by their members' scores. */
  sum?: boolean;
}

const sameMembers = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

/** A side's score: its members' scores added (`1v3`: the average, so three do not beat one by count). */
function sideScore(input: ResultInput, r: GameResults, side: readonly string[]): number {
  const total = side.reduce(
    (sum, id) => sum + (Number.isFinite(r.scores[id]) ? (r.scores[id] as number) : 0),
    0,
  );
  return input.mode === '1v3' ? total / Math.max(1, side.length) : total;
}

/** The side a game's results name as the winner: its `outcome`, else a `winnerIds` inside one side. */
function winningTeamOf(input: ResultInput, r: GameResults): number | null {
  if (input.teams.length < 2) return null;
  if (input.sum) {
    const [a, b] = input.teams.map((side) => sideScore(input, r, side));
    return a === undefined || b === undefined || a === b ? null : a > b ? 0 : 1;
  }
  const o = r.outcome;
  if (o && o.kind === 'teams') {
    const won = o.teams.find((t) => t.id === o.winner);
    const at = won ? input.teams.findIndex((t) => sameMembers(t, won.members)) : -1;
    if (at >= 0) return at;
    if (o.winner === null) return null;
  }
  const known = r.winnerIds.filter((id) => input.players.some((p) => p.id === id));
  if (!known.length) return null;
  const sides = new Set(known.map((id) => input.teams.findIndex((t) => t.includes(id))));
  const [only] = [...sides];
  return sides.size === 1 && only !== undefined && only >= 0 ? only : null;
}

/** Every id in `players` ranked: the game's ranks first, anyone it left out last (tied). */
export function normalizeResult(input: ResultInput, r: GameResults | null): MinigameResult {
  const ids = input.players.map((p) => p.id);
  const base = { gameId: input.gameId, mode: input.mode };
  if (!r) {
    return {
      ...base,
      ranking: ids.map((playerId) => ({ playerId, rank: 1 })),
      winnerIds: [],
      winningTeam: null,
    };
  }
  const seen = new Set<string>();
  const ranked: { playerId: string; rank: number; score?: number }[] = [];
  for (const row of r.ranking) {
    if (!ids.includes(row.playerId) || seen.has(row.playerId)) continue;
    seen.add(row.playerId);
    ranked.push({
      playerId: row.playerId,
      rank: Math.max(1, Math.floor(row.rank) || 1),
      ...(Number.isFinite(row.score) ? { score: row.score } : {}),
    });
  }
  const last = ranked.reduce((m, row) => Math.max(m, row.rank), 0) + 1;
  for (const id of ids) if (!seen.has(id)) ranked.push({ playerId: id, rank: last });
  ranked.sort((a, b) => a.rank - b.rank);
  const winningTeam = winningTeamOf(input, r);
  if (winningTeam !== null) {
    const side = input.teams[winningTeam] ?? [];
    const rows = ranked.map((row) => ({ ...row, rank: side.includes(row.playerId) ? 1 : 2 }));
    rows.sort((a, b) => a.rank - b.rank);
    return { ...base, ranking: rows, winnerIds: [...side], winningTeam };
  }
  const lost = r.outcome?.kind === 'coop' && !r.outcome.won;
  const known = r.winnerIds.filter((id) => ids.includes(id));
  const top = ranked.filter((row) => row.rank === 1).map((row) => row.playerId);
  const picked = known.length ? known : top;
  // A whole table "winning" is a draw (nobody tried, or a dead heat), not four prizes; a won co-op is the exception.
  const draw = ids.length > 1 && picked.length >= ids.length && r.outcome?.kind !== 'coop';
  const tiedSides = input.sum === true && input.teams.length >= 2; // equal side totals: a draw
  const winnerIds = lost || draw || tiedSides ? [] : picked;
  return { ...base, ranking: ranked, winnerIds, winningTeam: null };
}
