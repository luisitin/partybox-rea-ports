// Speed points and bounded streaks, credited exactly once at the reveal.
import { buildResults, compareCodeUnits, shuffle, teamResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import { currentQuestion } from './content';
import { modeOf, scoringMembers, teamOf, teamRank } from './teams';
import type { Answer, State, Verdict } from './types';
import type { Standing } from './views';

export function speedPoints(elapsed: number, duration: number): number {
  const fraction = Math.max(0, Math.min(1, elapsed / Math.max(1, duration)));
  return Math.round(1000 * (1 - fraction / 2));
}

export function judge(state: State): Record<string, Verdict> {
  const correct = currentQuestion(state).correct;
  return Object.fromEntries(
    Object.keys(state.players).map((id) => {
      const answer = Object.hasOwn(state.answers, id) ? state.answers[id] : undefined;
      return [id, verdictFor(answer, correct, state.streaks[id] ?? 0, state.answerMs)];
    }),
  );
}

function verdictFor(
  answer: Answer | undefined,
  correct: number,
  previousStreak: number,
  duration: number,
): Verdict {
  const right = answer?.choice === correct;
  const streak = right ? previousStreak + 1 : 0;
  const base = right ? speedPoints(answer!.elapsed, duration) : 0;
  const bonus = right ? Math.min(500, Math.max(0, streak - 1) * 100) : 0;
  return {
    outcome: right ? 'correct' : answer ? 'wrong' : 'timeout',
    base,
    bonus,
    points: base + bonus,
    streak,
  };
}

/** Called only when entering reveal: all votes and group gains land atomically. */
export function scoreRound(state: State): State {
  const mode = modeOf(state);
  let verdicts = judge(state);
  let decision: number | null = null;
  let rng = state.rng;
  let roomStreak = state.roomStreak;
  if (mode === 'tv-vote') {
    const answers = Object.values(state.answers);
    if (answers.length > 0) {
      const counts = [0, 0, 0, 0];
      for (const answer of answers) counts[answer.choice] = (counts[answer.choice] ?? 0) + 1;
      const highest = Math.max(...counts);
      const tied = [0, 1, 2, 3].filter((choice) => counts[choice] === highest);
      if (tied.length > 1) {
        const [order, after] = shuffle(rng, tied);
        decision = order[0]!;
        rng = after;
      } else decision = tied[0]!;
    }
    const collective = verdictFor(
      decision === null
        ? undefined
        : {
            choice: decision,
            elapsed:
              Object.values(state.answers).reduce((sum, answer) => sum + answer.elapsed, 0) /
              Object.keys(state.answers).length,
          },
      currentQuestion(state).correct,
      state.roomStreak,
      state.answerMs,
    );
    roomStreak = collective.streak;
    verdicts = Object.fromEntries(Object.keys(state.players).map((id) => [id, { ...collective }]));
  }
  const streaks = Object.fromEntries(Object.entries(verdicts).map(([id, v]) => [id, v.streak]));
  if (mode === 'solo') {
    const scores = { ...state.scores };
    for (const [id, v] of Object.entries(verdicts)) scores[id] = (scores[id] ?? 0) + v.points;
    return { ...state, scores, streaks, verdicts };
  }
  const teamGains: Record<string, number> = {};
  const teamScores = { ...state.teamScores };
  const scores = { ...state.scores };
  for (const team of state.teams) {
    const members = scoringMembers(state, team);
    const gained =
      mode === 'tv-vote'
        ? (Object.values(verdicts)[0]?.points ?? 0)
        : members.length === 0
          ? 0
          : Math.round(
              members.reduce((sum, id) => sum + (verdicts[id]?.points ?? 0), 0) / members.length,
            );
    teamGains[team.id] = gained;
    teamScores[team.id] = (teamScores[team.id] ?? 0) + gained;
    for (const id of team.members) scores[id] = teamScores[team.id]!;
  }
  return { ...state, scores, streaks, verdicts, teamScores, teamGains, decision, roomStreak, rng };
}

export function standings(state: State): Standing[] {
  if (modeOf(state) !== 'solo') {
    return [...state.teams]
      .sort(
        (a, b) =>
          (state.teamScores[b.id] ?? 0) - (state.teamScores[a.id] ?? 0) ||
          compareCodeUnits(a.id, b.id),
      )
      .map((team) => ({
        id: team.id,
        name: team.name,
        avatarId: state.players[team.members[0] ?? '']?.avatarId ?? '',
        rank: teamRank(state, team.id),
        score: state.teamScores[team.id] ?? 0,
        gained: state.teamGains[team.id] ?? 0,
      }));
  }
  const sorted = Object.values(state.players).sort(
    (a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0) || compareCodeUnits(a.id, b.id),
  );
  return sorted.map((p) => ({
    id: p.id,
    name: p.name,
    avatarId: p.avatarId,
    rank:
      1 +
      sorted.filter((other) => (state.scores[other.id] ?? 0) > (state.scores[p.id] ?? 0)).length,
    score: state.scores[p.id] ?? 0,
    gained: Object.hasOwn(state.verdicts, p.id) ? state.verdicts[p.id]!.points : 0,
  }));
}

export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  const result = buildResults(state, state.scores);
  if (modeOf(state) === 'solo') return result;
  const ranking = result.ranking.map((row) => ({
    ...row,
    rank: teamRank(state, teamOf(state, row.playerId)!.id),
  }));
  const winners = state.teams.filter((team) => teamRank(state, team.id) === 1);
  return teamResults(
    {
      ...result,
      ranking,
      winnerIds: ranking.filter((row) => row.rank === 1).map((row) => row.playerId),
    },
    {
      winner: winners.length === 1 ? winners[0]!.id : null,
      teams: state.teams.map((team) => ({ ...team, members: [...team.members] })),
    },
  );
}
