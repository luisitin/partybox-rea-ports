import { rank } from '@partybox/game-sdk';
import type { State } from './types';
import { quizModeOf } from './types';

export interface StandingRow {
  playerId: string;
  name: string;
  avatarId: string;
  connected: boolean;
  score: number;
  rank: number;
  delta?: number;
}

export function standingsOf(state: State): StandingRow[] {
  return rank(state.scores).flatMap((r) => {
    const p = state.players[r.playerId];
    return p
      ? [
          {
            playerId: p.id,
            name: p.name,
            avatarId: p.avatarId,
            connected: p.connected,
            score: r.score,
            rank: r.rank,
            ...(quizModeOf(state) === 'classic' && state.phase.id === 'reveal'
              ? { delta: state.lastDelta[p.id] ?? 0 }
              : {}),
          },
        ]
      : [];
  });
}

/** Competition ranks preserve genuine ties; vacant second/third tiers are skipped. */
export function occupiedPodiumRanks(state: State): (1 | 2 | 3)[] {
  return [
    ...new Set(
      standingsOf(state)
        .map((r) => r.rank)
        .filter((r) => r <= 3),
    ),
  ].sort((a, b) => b - a) as (1 | 2 | 3)[];
}

export function revealedPodiumEntries(state: State): StandingRow[] {
  const current = state.podiumRank ?? 1;
  return standingsOf(state).filter((r) => r.rank >= current && r.rank <= 3);
}
