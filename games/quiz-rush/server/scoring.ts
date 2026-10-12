// Speed points and bounded streaks, credited exactly once at the reveal.
import { buildResults, compareCodeUnits } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import { currentQuestion } from './content';
import type { State, Verdict } from './types';
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
      const right = answer?.choice === correct;
      const streak = right ? (state.streaks[id] ?? 0) + 1 : 0;
      const base = right ? speedPoints(answer!.elapsed, state.answerMs) : 0;
      const bonus = right ? Math.min(500, Math.max(0, streak - 1) * 100) : 0;
      return [
        id,
        {
          outcome: right ? 'correct' : answer ? 'wrong' : 'timeout',
          base,
          bonus,
          points: base + bonus,
          streak,
        },
      ];
    }),
  );
}

export function standings(state: State): Standing[] {
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
  return state.phase.id === 'done' ? buildResults(state, state.scores) : null;
}
