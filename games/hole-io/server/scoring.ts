// Eliminated and departed players keep banked intake; accumulated points determine rank.
import { rank } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State, World } from './types';

export function scoresOf(world: World): Record<string, number> {
  return Object.fromEntries(world.holes.map((h) => [h.id, h.score]));
}
export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  // SDK completeScores assigns into {}, which loses a legitimate '__proto__' roster key.
  // Our own-key score map is already complete; the SDK's rank preserves every entry.
  const scores = scoresOf(state.world);
  const ranking = rank(scores);
  return {
    scores,
    ranking,
    winnerIds: ranking.filter((r) => r.rank === 1).map((r) => r.playerId),
    awards: [],
  };
}
