// Fixed, seeded groups. A drop changes eligibility, never somebody's team.
import { shuffle } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import type { QuizMode, State, Team } from './types';

export function modeOf(state: State): QuizMode {
  return state.settings.mode ?? 'solo';
}

export function makeTeams(
  mode: QuizMode,
  ids: readonly string[],
  requested: number,
  rng: RngState,
): [Team[], RngState] {
  // Solo must consume exactly the same random sequence as the original port.
  if (mode === 'solo') return [[], rng];
  if (mode === 'tv-vote') return [[{ id: 'room', name: 'The room', members: [...ids] }], rng];
  if (ids.length === 0) return [[], rng];
  const count = Math.min(ids.length, Math.max(2, Math.min(4, Math.round(requested))));
  const [shuffled, after] = shuffle(rng, ids);
  const teams: Team[] = Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    members: shuffled.filter((_id, seat) => seat % count === index),
  }));
  return [teams, after];
}

export function teamOf(state: State, playerId: string): Team | null {
  return state.teams?.find((team) => team.members.includes(playerId)) ?? null;
}

export function teamRank(state: State, teamId: string): number {
  const score = state.teamScores[teamId] ?? 0;
  return 1 + state.teams.filter((team) => (state.teamScores[team.id] ?? 0) > score).length;
}

/** Answered departures count; only unanswered offline/left seats leave the mean. */
export function scoringMembers(state: State, team: Team): string[] {
  return team.members.filter(
    (id) =>
      Object.hasOwn(state.answers, id) ||
      (state.players[id]?.connected === true && !state.left.includes(id)),
  );
}
