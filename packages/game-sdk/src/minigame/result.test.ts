// ADR-087: normalizeResult turns a game's results() into the minigame ranking.
import { describe, expect, it } from 'vitest';
import type { GameResults, PlayerInfo } from '@partybox/shared';
import { normalizeResult } from './result';

const players: PlayerInfo[] = ['p1', 'p2', 'p3', 'p4'].map((id) => ({
  id,
  name: id,
  avatarId: 'fox',
  connected: true,
}));
const input = { gameId: 'g', mode: 'ffa' as const, players, teams: [] };
const results = (ranks: number[], winnerIds: string[]): GameResults => ({
  ranking: ranks.map((rank, i) => ({ playerId: `p${i + 1}`, rank, score: 0 })),
  scores: {},
  awards: [],
  winnerIds,
});

describe('normalizeResult', () => {
  it('ranks every player, the game’s winner first', () => {
    const r = normalizeResult(input, results([2, 1, 3, 4], ['p2']));
    expect(r.winnerIds).toEqual(['p2']);
    expect(r.ranking.map((x) => x.playerId)).toEqual(['p2', 'p1', 'p3', 'p4']);
  });

  it('keeps the game’s own score on each row for the results screen', () => {
    const g = results([2, 1, 3, 4], ['p2']);
    g.ranking[1] = { playerId: 'p2', rank: 1, score: 12.5 };
    const r = normalizeResult(input, g);
    expect(r.ranking[0]).toMatchObject({ playerId: 'p2', score: 12.5 });
  });

  it('a whole table tied at the top is a draw, not four winners', () => {
    expect(normalizeResult(input, results([1, 1, 1, 1], [])).winnerIds).toEqual([]);
    expect(
      normalizeResult(input, results([1, 1, 1, 1], ['p1', 'p2', 'p3', 'p4'])).winnerIds,
    ).toEqual([]);
  });

  it('a tie among some players still pays those players', () => {
    expect(normalizeResult(input, results([1, 1, 3, 3], [])).winnerIds).toEqual(['p1', 'p2']);
  });

  describe('teamScore sum (a game with no team knowledge)', () => {
    const scored = (scores: Record<string, number>): GameResults => ({
      ranking: Object.keys(scores).map((playerId, i) => ({ playerId, rank: i + 1, score: 0 })),
      scores,
      awards: [],
      winnerIds: [],
    });
    const two = {
      ...input,
      mode: '2v2' as const,
      teams: [
        ['p1', 'p2'],
        ['p3', 'p4'],
      ],
      sum: true,
    };
    const solo = { ...input, mode: '1v3' as const, teams: [['p1'], ['p2', 'p3', 'p4']], sum: true };

    it('the side with the higher total wins 2v2', () => {
      const r = normalizeResult(two, scored({ p1: 5, p2: 4, p3: 4, p4: 4 }));
      expect(r.winningTeam).toBe(0);
      expect(r.winnerIds).toEqual(['p1', 'p2']);
    });

    it('1v3 compares the lone player with the average of the others', () => {
      expect(normalizeResult(solo, scored({ p1: 5, p2: 4, p3: 4, p4: 4 })).winningTeam).toBe(0);
      expect(normalizeResult(solo, scored({ p1: 3, p2: 4, p3: 4, p4: 4 })).winningTeam).toBe(1);
    });

    it('equal sides are a draw; a bad score counts as 0', () => {
      const r = normalizeResult(two, scored({ p1: 2, p2: 2, p3: 4, p4: Number.NaN }));
      expect(r.winningTeam).toBeNull();
      expect(r.winnerIds).toEqual([]);
    });
  });
});
