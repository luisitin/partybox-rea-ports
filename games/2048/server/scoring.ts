// Actual merge points stay visible; reaching the target outranks a higher non-finisher score.
import { buildResults } from '@partybox/game-sdk';
import type { GameResults } from '@partybox/game-sdk';
import type { Racer, State } from './types';

export function compareRacers(a: Racer, b: Racer): number {
  const finished = Number(b.status === 'finished') - Number(a.status === 'finished');
  return finished || b.score - a.score;
}

export function winners(state: State): string[] {
  const entries = Object.entries(state.racers).sort((a, b) => compareRacers(a[1], b[1]));
  const leader = entries[0]?.[1];
  return leader ? entries.filter(([, r]) => compareRacers(r, leader) === 0).map(([id]) => id) : [];
}

export function results(state: State): GameResults | null {
  if (state.phase.id !== 'done') return null;
  const scores = Object.fromEntries(Object.entries(state.racers).map(([id, r]) => [id, r.score]));
  const base = buildResults(state, scores);
  const ranking = Object.entries(state.racers)
    .sort((a, b) => compareRacers(a[1], b[1]))
    .map(([id, racer]) => ({
      playerId: id,
      score: racer.score,
      rank: 1 + Object.values(state.racers).filter((r) => compareRacers(r, racer) < 0).length,
    }));
  return {
    ...base,
    ranking,
    winnerIds: winners(state),
    headlineNote: state.reason === 'target' ? 'First to 2048' : 'Highest merge score',
    detail: { reason: state.reason },
  };
}
