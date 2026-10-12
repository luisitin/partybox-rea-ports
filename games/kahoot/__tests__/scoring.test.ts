// Scoring rules from README.md "Scoring", hand-computed: speed points, streak bonus + cap, resets,
// wager options and amounts, the final +/− wager, and the three awards.
import { describe, expect, it } from 'vitest';
import type { Rng } from '@partybox/game-sdk';
import { game } from '../server/index';
import { answerWindowOf } from '../server/types';
import { awards, clampWager, questionPoints, wagerAmount, wagerOptions } from '../server/scoring';
import {
  PLAYERS,
  input,
  phone,
  pick,
  playQuestion,
  start,
  timer,
  toWager,
  vip,
  wager,
} from './helpers';

describe('questionPoints', () => {
  it('is 1000 at 0 ms, 750 at half time, 500 at the deadline (10 s window)', () => {
    expect(questionPoints(0, 10, 1)).toBe(1000);
    expect(questionPoints(5_000, 10, 1)).toBe(750);
    expect(questionPoints(10_000, 10, 1)).toBe(500);
    expect(questionPoints(99_000, 10, 1)).toBe(500);
  });

  it('adds 100 per extra streak step, capped at 300', () => {
    expect(questionPoints(0, 10, 2)).toBe(1100);
    expect(questionPoints(0, 10, 3)).toBe(1200);
    expect(questionPoints(0, 10, 4)).toBe(1300);
    expect(questionPoints(0, 10, 9)).toBe(1300);
  });
});

describe('per-question scoring in play', () => {
  it('scores correct picks by speed, wrong picks 0, and tracks streaks', () => {
    let s = timer(start({ answerSeconds: 10 }));
    s = pick(s, 'a', true, 0);
    s = pick(s, 'b', true, answerWindowOf(s) / 2);
    s = pick(s, 'c', false, 2_000);
    if (s.phase.id === 'question') s = timer(s);
    expect(s.phase.id).toBe('reveal');
    expect(s.scores).toEqual({ a: 1000, b: 750, c: 0 });
    expect(s.streaks).toEqual({ a: 1, b: 1, c: 0 });
    expect(s.lastDelta).toEqual({ a: 1000, b: 750, c: 0 });
    // Second question: a keeps the streak (+100), b answers wrong (streak reset), c idle.
    s = timer(s);
    s = pick(s, 'a', true, answerWindowOf(s) - 1);
    s = pick(s, 'b', false, 100);
    s = timer(s);
    expect(s.scores).toEqual({ a: 1600, b: 750, c: 0 });
    expect(s.streaks).toEqual({ a: 2, b: 0, c: 0 });
  });

  it('caps the streak bonus at +300 from the fourth correct answer on', () => {
    let s = timer(start({ answerSeconds: 10, questions: 6 }));
    const gains: number[] = [];
    for (let i = 0; i < 5; i++) {
      s = pick(s, 'a', true, answerWindowOf(s) - 1); // last accepted millisecond: base + streak
      s = timer(s);
      gains.push(s.lastDelta['a'] ?? 0);
      s = timer(s);
    }
    expect(gains).toEqual([500, 600, 700, 800, 800]);
  });

  it('measures speed against the deadline so a pause does not cost points', () => {
    let s = timer(start({ answerSeconds: 10 }));
    s = vip(s, 'pause', s.phase.startedAt + 1_000);
    s = vip(s, 'resume', s.phase.startedAt + 4_000); // paused 3 s → deadline shifts by 3 s
    s = pick(s, 'a', true, 5_000); // 5 s after start, but only 2 s of it counted down
    expect(s.picks['a']?.elapsedMs).toBe(2_000);
  });
});

describe('wagers', () => {
  it('offers 0/25/50/75 % rounded down to tens and all in, collapsing duplicates', () => {
    expect(wagerOptions(1234)).toEqual([
      { percent: 0, amount: 0 },
      { percent: 25, amount: 300 },
      { percent: 50, amount: 610 },
      { percent: 75, amount: 920 },
      { percent: 100, amount: 1234 },
    ]);
    expect(wagerOptions(0)).toEqual([{ percent: 0, amount: 0 }]);
    expect(wagerOptions(12)).toEqual([
      { percent: 0, amount: 0 },
      { percent: 100, amount: 12 },
    ]);
    expect(wagerAmount(0, 100)).toBe(0);
    expect(wagerAmount(-5, 100)).toBe(0);
  });

  it('a custom stake (I-026) is clamped to the score and rounded down to tens', () => {
    expect(clampWager(967, 120)).toBe(120);
    expect(clampWager(967, 125)).toBe(120);
    expect(clampWager(967, 5000)).toBe(967);
    expect(clampWager(967, 967)).toBe(967);
    expect(clampWager(967, 0)).toBe(0);
    expect(clampWager(0, 50)).toBe(0);
    let s = toWager(start(), { a: true, b: true });
    const score = s.scores['a'] ?? 0;
    expect(score).toBeGreaterThan(0);
    s = input(s, 'a', { type: 'wager', amount: 10 }, s.phase.startedAt + 1);
    expect(s.wagers['a']).toBe(10);
    s = input(s, 'b', { type: 'wager', amount: 10_000 }, s.phase.startedAt + 1);
    expect(s.wagers['b']).toBe(s.scores['b']);
  });

  it('a 0-score player can only wager 0 whatever percent they send', () => {
    let s = toWager(start(), { a: true });
    expect(s.scores['b']).toBe(0);
    expect(phone(s, 'b').wagerChoices).toEqual([{ percent: 0, amount: 0 }]);
    s = wager(s, 'b', 100);
    expect(s.wagers['b']).toBe(0);
    expect(
      game.bot.sampleInput(s, 'c', {
        ...fakeRng(),
        pick: <T>(items: readonly T[]): T => items[items.length - 1] as T,
      }),
    ).toEqual({ type: 'wager', percent: 0 });
  });

  it('a second wager is ignored; missing wagers count as 0 at the deadline', () => {
    let s = toWager(start(), { a: true });
    s = wager(s, 'a', 50);
    const amount = s.wagers['a'];
    expect(amount).toBeGreaterThan(0);
    expect(wager(s, 'a', 100)).toBe(s);
    s = timer(s);
    expect(s.phase.id).toBe('question');
    expect(s.wagers).toEqual({ a: amount });
  });

  it('final question: correct adds the wager, wrong or idle subtracts it (score can drop)', () => {
    let s = toWager(start({ answerSeconds: 10 }), { a: true, b: true, c: true });
    const before = { ...s.scores };
    s = wager(s, 'a', 100);
    s = wager(s, 'b', 50);
    s = wager(s, 'c', 25);
    const bets = { ...s.wagers };
    if (s.phase.id === 'wager') s = timer(s);
    s = pick(s, 'a', true);
    s = pick(s, 'b', false);
    s = timer(s); // c idle
    expect(s.phase.id).toBe('reveal');
    expect(s.scores['a']).toBe((before['a'] ?? 0) + (bets['a'] ?? 0));
    expect(s.scores['b']).toBe((before['b'] ?? 0) - (bets['b'] ?? 0));
    expect(s.scores['c']).toBe((before['c'] ?? 0) - (bets['c'] ?? 0));
    expect(s.scores['b']).toBeLessThan(before['b'] ?? 0);
    expect(s.scores['c']).toBeGreaterThanOrEqual(0);
    expect(s.lastDelta['c']).toBe(-(bets['c'] ?? 0));
    expect(s.stats['a']?.wagerWon).toBe(bets['a']);
    expect(s.stats['b']?.wagerWon).toBe(0);
    s = timer(s);
    expect(game.results(s)?.scores).toEqual(s.scores);
  });
});

describe('awards and results', () => {
  it('names real players for lightning fingers, hot streak and high roller', () => {
    let s = timer(start({ answerSeconds: 10 }));
    // a: fast and always right; b: right twice then wrong; c: never.
    s = playQuestion(s, { a: true, b: true }, { a: 1_000, b: 3_000 });
    s = playQuestion(s, { a: true, b: true }, { a: 1_000, b: 3_000 });
    s = playQuestion(s, { a: true, b: false }, { a: 1_000, b: 3_000 });
    s = playQuestion(s, { a: true }, { a: 1_000 });
    s = playQuestion(s, { a: true }, { a: 1_000 });
    expect(s.phase.id).toBe('wager');
    s = wager(s, 'a', 25);
    s = wager(s, 'b', 100);
    s = timer(s);
    s = pick(s, 'a', false);
    s = pick(s, 'b', true);
    s = timer(s);
    s = timer(s);
    const results = game.results(s);
    expect(results).not.toBeNull();
    expect(results?.awards.map((a) => [a.id, a.playerId])).toEqual([
      ['lightning-fingers', 'a'],
      ['hot-streak', 'a'],
      ['high-roller', 'b'],
    ]);
    expect(results?.awards.find((a) => a.id === 'hot-streak')?.description).toContain('5');
    for (const a of results?.awards ?? []) expect(PLAYERS.map((p) => p.id)).toContain(a.playerId);
    expect(results?.ranking.map((r) => r.playerId)).toContain('c');
  });

  it('gives no awards when nobody qualifies and shares first place on ties', () => {
    let s = start();
    for (let step = 0; step < 100 && game.results(s) === null; step++) s = timer(s);
    expect(s.phase.id).toBe('done');
    const results = game.results(s);
    expect(results?.awards).toEqual([]);
    expect(results?.winnerIds.sort()).toEqual(['a', 'b', 'c']);
    expect(awards(s)).toEqual([]);
  });

  it('a streak of 1 or a lost wager does not earn an award', () => {
    let s = timer(start());
    s = playQuestion(s, { a: true });
    s = playQuestion(s, { a: false });
    expect(awards(s).map((a) => a.id)).toEqual(['lightning-fingers']);
  });
});

function fakeRng(): Rng {
  return {
    float: () => 0.99,
    int: (min) => min,
    pick: (items) => items[0] as never,
    shuffle: (items) => [...items],
    chance: () => false,
    state: () => ({ seed: 0, step: 0 }),
  };
}
