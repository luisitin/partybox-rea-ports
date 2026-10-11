// Height alone decides the race. Equal best heights share a rank.
import { compareCodeUnits } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';

export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  // Object.fromEntries retains legitimate IDs such as __proto__ as own keys.
  const scores = Object.fromEntries(
    state.towers.map((tower) => [tower.id, state.scores[tower.id] ?? tower.best]),
  );
  const ordered = Object.entries(scores).sort(
    (a, b) => b[1] - a[1] || compareCodeUnits(a[0], b[0]),
  );
  const ranking = ordered.map(([playerId, score]) => ({
    playerId,
    score,
    rank: 1 + ordered.filter(([, other]) => other > score).length,
  }));
  return {
    scores,
    ranking,
    winnerIds: ranking.filter((row) => row.rank === 1).map((row) => row.playerId),
    awards: [],
  };
}
