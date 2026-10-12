import { rank, teamResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';

export function scores(state: State): Record<string, number> {
  return Object.fromEntries(
    Object.keys(state.players).map((id) => [id, state.goals[state.teams[id]!] ?? 0]),
  );
}
export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  const winner =
    state.goals.red === state.goals.blue
      ? null
      : state.goals.red > state.goals.blue
        ? 'red'
        : 'blue';
  // Object.fromEntries preserves even prototype-looking original IDs; helpers never enter it.
  const complete = scores(state);
  const ranking = rank(complete);
  return teamResults(
    {
      scores: complete,
      ranking,
      winnerIds: ranking.filter((row) => row.rank === 1).map((row) => row.playerId),
      awards: [],
    },
    {
      winner,
      teams: ['red', 'blue'].map((team) => ({
        id: team,
        name: team === 'red' ? 'Red' : 'Blue',
        mark: team === 'red' ? 'R' : 'B',
        members: Object.keys(state.players).filter((id) => state.teams[id] === team),
      })),
    },
    winner ? `${winner === 'red' ? 'Red' : 'Blue'} wins!` : 'Draw — both teams share first!',
  );
}
