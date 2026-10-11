// Audit #6 (T-0054): the standings every game built for the Scoreboard, and where its rows climb from.
import { describe, expect, it } from 'vitest';
import type { ViewPlayer } from '@partybox/shared';
import { standingsWithDelta } from './scoring';
import { boardRows, climbOrder } from './tv/Scoreboard';

const players: ViewPlayer[] = [
  { id: 'p1', name: 'Ana', avatarId: 'fox', connected: true, status: 'active' },
  { id: 'p2', name: 'Ben', avatarId: 'owl', connected: false, status: 'active' },
  { id: 'p3', name: 'Cy', avatarId: 'cat', connected: true, status: 'active' },
];

describe('standingsWithDelta', () => {
  it('ranks every id (missing → 0) with its change since the round began', () => {
    expect(standingsWithDelta(['p1', 'p2', 'p3'], { p1: 5, p3: 9 }, { p1: 2, p3: 9 })).toEqual([
      { playerId: 'p3', score: 9, rank: 1, delta: 0 },
      { playerId: 'p1', score: 5, rank: 2, delta: 3 },
      { playerId: 'p2', score: 0, rank: 3, delta: 0 },
    ]);
  });
});

describe('boardRows', () => {
  it("puts each player's name, face and link on the row; an unknown id reads '?'", () => {
    const rows = boardRows(players, [
      { playerId: 'p2', score: 4, rank: 1, delta: 4 },
      { playerId: 'zz', score: 0, rank: 2 },
    ]);
    expect(rows).toEqual([
      {
        playerId: 'p2',
        score: 4,
        rank: 1,
        delta: 4,
        name: 'Ben',
        avatarId: 'owl',
        connected: false,
      },
      {
        playerId: 'zz',
        score: 0,
        rank: 2,
        name: '?',
        avatarId: 'ghost',
        connected: false,
      },
    ]);
  });
});

describe('climbOrder', () => {
  const rows = [
    { playerId: 'p3', score: 6, delta: 6 },
    { playerId: 'p2', score: 5, delta: 0 },
    { playerId: 'p1', score: 4, delta: 4 },
  ];

  it('orders by the score before the round, ties in roster order', () => {
    expect(climbOrder(rows, players)).toEqual(['p2', 'p1', 'p3']);
  });

  it("keeps the rows' own order for ties without a roster", () => {
    expect(climbOrder(rows)).toEqual(['p2', 'p3', 'p1']);
  });
});
