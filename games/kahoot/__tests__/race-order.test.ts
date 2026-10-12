// I-589: the reveal is the race.
import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../server/content';
import { tvView } from '../server/views';
import type { State } from '../server/types';

describe('I-589: right answers fastest first', () => {
  it('orders the right rows by their time and gives them the time', () => {
    const q = QUESTIONS[0]!;
    const right = q.answerIndex;
    const wrong = (right + 1) % q.choices.length;
    const s = {
      phase: { id: 'reveal', startedAt: 0, deadline: 5000 },
      players: {
        a: { id: 'a', name: 'A', avatarId: 'fox', connected: true },
        b: { id: 'b', name: 'B', avatarId: 'owl', connected: true },
        c: { id: 'c', name: 'C', avatarId: 'cat', connected: true },
      },
      scores: { a: 2000, b: 100, c: 50 },
      streaks: {},
      lastDelta: {},
      wagers: {},
      picks: {
        a: { index: right, elapsedMs: 4000 },
        b: { index: right, elapsedMs: 1200 },
        c: { index: wrong, elapsedMs: 500 },
      },
      questionIds: [q.id, 'final'],
      index: 0,
      settings: { questions: 1, answerSeconds: 20 },
      drawnFrom: 'all',
      stats: {},
    } as unknown as State;
    const rows = tvView(s, 'kahoot').rows ?? [];
    expect(rows.map((r) => r.playerId)).toEqual(['b', 'a', 'c']); // b answered first, though a leads
    expect(rows[0]?.elapsedMs).toBe(1200);
    expect(rows[2]?.elapsedMs).toBeUndefined();
  });
});
