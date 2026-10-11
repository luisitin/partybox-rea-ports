// Scoring for Quick Poll: one point per submitted answer. Trivial on purpose — it shows where
// scoring lives and how results are assembled.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { State } from './types';

export function scoreAnswers(state: State): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(state.players)) scores[id] = id in state.answers ? 1 : 0;
  return scores;
}

export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  return buildResults(state, state.scores);
}
