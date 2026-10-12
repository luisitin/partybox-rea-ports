import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import type { State } from '../server/types';
import { phone, pick, start, toFirstQuestion, toWager, tv, wager } from './helpers';

function connected(state: State, playerId: string, value: boolean): State {
  return game.reduce(state, {
    type: 'player',
    playerId,
    connected: value,
    now: state.phase.startedAt + 1_500,
  });
}

describe('the TV counts submissions from its connected roster', () => {
  it.each(['question', 'wager'] as const)(
    '%s stays consistent after a submitted phone drops',
    (phase) => {
      let s = phase === 'question' ? toFirstQuestion(start()) : toWager(start());
      s = phase === 'question' ? pick(s, 'a', true) : wager(s, 'a', 0);
      s = phase === 'question' ? pick(s, 'b', true) : wager(s, 'b', 0);
      expect(tv(s)).toMatchObject({ answeredCount: 2, totalCount: 3 });

      s = connected(s, 'a', false);
      expect(s.phase.id).toBe(phase);
      expect(tv(s)).toMatchObject({ answeredCount: 1, totalCount: 2 });
      expect(
        tv(s)
          .players.filter((p) => p.connected && p.status === 'active')
          .map((p) => p.id),
      ).toEqual(['c']);
      expect(phone(s, 'c').myPickIndex).toBeNull();
      if (phase === 'wager') expect(phone(s, 'c').myWagerAmount).toBeUndefined();

      s = connected(s, 'b', false);
      expect(tv(s)).toMatchObject({ answeredCount: 0, totalCount: 1 });
      expect(s.phase.id).toBe(phase);

      s = connected(s, 'a', true);
      expect(tv(s)).toMatchObject({ answeredCount: 1, totalCount: 2 });
      expect(s.phase.id).toBe(phase);
      if (phase === 'question') expect(phone(s, 'a').myPickIndex).not.toBeNull();
      else expect(phone(s, 'a').myWagerAmount).toBe(0);
    },
  );
});
