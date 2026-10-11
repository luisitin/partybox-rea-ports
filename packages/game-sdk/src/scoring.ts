// Scoring helpers shared by games: rankings with shared ranks for ties, results assembly, and
// speed-scaled points. Pure; safe inside reducers.
import type {
  GameAward,
  GameOutcome,
  GameResults,
  GameStateBase,
  PlayerInfo,
} from '@partybox/shared';
import { compareCodeUnits } from './compare';

export interface RankedRow {
  playerId: string;
  score: number;
  rank: number;
}

/** Highest score first; equal scores share a rank ("1, 2, 2, 4"); ties broken by id for stability. */
export function rank(scores: Record<string, number>): RankedRow[] {
  const rows = Object.entries(scores)
    .map(([playerId, score]) => ({ playerId, score: Number.isFinite(score) ? score : 0, rank: 0 }))
    .sort((a, b) => b.score - a.score || compareCodeUnits(a.playerId, b.playerId));
  let lastScore: number | null = null;
  let lastRank = 0;
  rows.forEach((row, index) => {
    if (row.score !== lastScore) {
      lastRank = index + 1;
      lastScore = row.score;
    }
    row.rank = lastRank;
  });
  return rows;
}

/** `scores` for every player in `state.players`, finite (missing or not finite → 0). */
export function completeScores(
  state: GameStateBase,
  scores: Readonly<Record<string, number>>,
): Record<string, number> {
  const complete: Record<string, number> = {};
  for (const id of Object.keys(state.players)) {
    const value = scores[id];
    complete[id] = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  return complete;
}

/** Every player ranked (`rank` over `completeScores`): nobody missing from a scoreboard. */
export function rankPlayers(
  state: GameStateBase,
  scores: Readonly<Record<string, number>>,
): RankedRow[] {
  return rank(completeScores(state, scores));
}

export interface StandingRow extends RankedRow {
  /** Points since `before` (a round's or a question's start). */
  delta: number;
}

/**
 * Audit #6: the standings between rounds — `ids` ranked by `scores` (missing → 0), each row with its
 * change since `before` (the round's start scores; missing → 0).
 */
export function standingsWithDelta(
  ids: readonly string[],
  scores: Readonly<Record<string, number>>,
  before: Readonly<Record<string, number>>,
): StandingRow[] {
  const complete: Record<string, number> = {};
  for (const id of ids) complete[id] = scores[id] ?? 0;
  return rank(complete).map((row) => ({ ...row, delta: row.score - (before[row.playerId] ?? 0) }));
}

/** Every player from `state.players` gets a finite score (missing → 0), as the contract requires. */
export function buildResults(
  state: GameStateBase,
  scores: Record<string, number>,
  awards: GameAward[] = [],
  seats: readonly PlayerInfo[] = [],
): GameResults {
  const complete = completeScores(state, scores);
  // Computer seats the game plays itself are ranked beside the players (they can win), see `GameResults.seats`.
  for (const seat of seats) {
    const value = scores[seat.id];
    complete[seat.id] = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  const ranking = rank(complete);
  return {
    scores: complete,
    ranking,
    winnerIds: ranking.filter((r) => r.rank === 1).map((r) => r.playerId),
    awards: awards.filter((a) => a.playerId in state.players),
    ...(seats.length > 0 ? { seats: seats.map((s) => ({ ...s })) } : {}),
  };
}

/**
 * ADR-052 co-op: the room wins together or nobody does. A win crowns `winners` (default: the
 * ranking's top); a loss crowns nobody. `headline` is the results line (English, translated by the
 * game's strings); without one the shell words it.
 */
export function coopResults(
  results: GameResults,
  won: boolean,
  headline?: string,
  winners: string[] = results.winnerIds,
): GameResults {
  return {
    ...results,
    winnerIds: won ? winners : [],
    outcome: { kind: 'coop', won },
    ...(headline ? { headline } : {}),
  };
}

/** A team game's ending (ADR-052): the winning team's id (`null` = a draw) and every team. */
export type TeamOutcome = Omit<Extract<GameOutcome, { kind: 'teams' }>, 'kind'>;

/** ADR-052 teams: which team won and who was on each, with the results line when there is one. */
export function teamResults(
  results: GameResults,
  outcome: TeamOutcome,
  headline?: string,
): GameResults {
  return {
    ...results,
    outcome: { kind: 'teams', ...outcome },
    ...(headline ? { headline } : {}),
  };
}

/**
 * Points for answering `elapsedMs` into a `windowMs` phase: `max` at 0 ms falling linearly to `min`
 * at the deadline. Always an integer, never below `min`.
 */
export function speedPoints(elapsedMs: number, windowMs: number, max: number, min = 0): number {
  if (windowMs <= 0) return max;
  const fraction = Math.min(1, Math.max(0, elapsedMs / windowMs));
  return Math.round(max - (max - min) * fraction);
}

/** Sums two score maps. */
export function addScores(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out = { ...a };
  for (const [id, value] of Object.entries(b)) out[id] = (out[id] ?? 0) + value;
  return out;
}
