// Group membership is fixed at init; presence changes only the scoring denominator.
import { rank, shuffle } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { groupModeOf, isParticipating } from './types';
import type { GroupMode, QuizTeam, State } from './types';

export function makeTeams(
  mode: GroupMode,
  ids: readonly string[],
  requested: number,
  rng: RngState,
): [QuizTeam[], RngState] {
  if (mode === 'tv-vote') return [[{ id: 'room', name: 'The room', members: [...ids] }], rng];
  if (ids.length === 0) return [[], rng];
  const count = Math.min(ids.length, Math.max(2, Math.min(4, Math.round(requested))));
  const [shuffled, after] = shuffle(rng, ids);
  return [
    Array.from({ length: count }, (_, i) => ({
      id: `team-${i + 1}`,
      name: `Team ${i + 1}`,
      members: shuffled.filter((_id, seat) => seat % count === i),
    })),
    after,
  ];
}

export function teamOf(state: State, playerId: string): QuizTeam | undefined {
  return state.teams?.find((team) => team.members.includes(playerId));
}

/** A locked answer keeps counting after a departure; an absent non-answer does not. */
export function scoringMembers(state: State, team: QuizTeam): string[] {
  return team.members.filter(
    (id) =>
      Object.hasOwn(state.picks, id) ||
      (state.players[id]?.connected === true && isParticipating(state, id)),
  );
}

export function groupStandings(state: State) {
  if (!groupModeOf(state)) return [];
  const teams = state.teams ?? [];
  return rank(
    Object.fromEntries(teams.map((team) => [team.id, state.teamScores?.[team.id] ?? 0])),
  ).map((row) => {
    const team = teams.find((t) => t.id === row.playerId)!;
    return {
      id: team.id,
      name: team.name,
      members: [...team.members],
      score: row.score,
      gained: state.teamGains?.[team.id] ?? 0,
      rank: row.rank,
    };
  });
}
