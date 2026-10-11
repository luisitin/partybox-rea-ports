import { describe, expect, it } from 'vitest';
import { results, standings } from '../server/scoring';
import { playing } from './helpers';

describe('survival ranking', () => {
  it('ranks the survivor first, later eliminations next, and points within a survival tie', () => {
    const s = playing();
    const state = {
      ...s,
      checked: s.began + 50_000,
      boards: s.boards.map((b, index) => ({
        ...b,
        alive: index === 0,
        score: [1, 1000, 800, 9000][index]!,
        diedAt: index === 0 ? null : s.began + [0, 40_000, 40_000, 20_000][index]!,
      })),
    };
    expect(standings(state).map((r) => [r.id, r.rank])).toEqual([
      ['p1', 1],
      ['p2', 2],
      ['p3', 3],
      ['p4', 4],
    ]);
    const done = { ...state, phase: { ...state.phase, id: 'done' } };
    expect(results(done)!.winnerIds).toEqual(['p1']);
    expect(results(done)!.ranking.map((r) => r.playerId)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('shares equal ranks and uses stable seat-id order for equal scores', () => {
    const state = playing();
    const rows = standings(state);
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(rows.every((r) => r.rank === 1)).toBe(true);
    const result = results({ ...state, phase: { ...state.phase, id: 'done' } })!;
    expect(result.winnerIds.sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(result.ranking.every((r) => r.rank === 1)).toBe(true);
  });
});
