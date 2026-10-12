// VIP actions from README.md "Edge cases": skip from every phase, end from anywhere, pause/resume.
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { pick, start, timer, toWager, tv, vip, wager } from './helpers';

describe('VIP skip', () => {
  it('intro → first question', () => {
    const s = vip(start(), 'skip');
    expect(s.phase.id).toBe('question');
    expect(s.index).toBe(0);
  });

  it('question → its reveal; unanswered players score 0 with no penalty', () => {
    let s = timer(start());
    s = pick(s, 'a', true);
    s = vip(s, 'skip');
    expect(s.phase.id).toBe('reveal');
    expect(s.scores['a']).toBeGreaterThan(0);
    expect(s.scores['b']).toBe(0);
    expect(s.lastDelta['b']).toBe(0);
  });

  it('reveal → next question, or the wager after the last regular question', () => {
    let s = timer(start({ questions: 5 }));
    s = vip(s, 'skip'); // reveal of q1
    s = vip(s, 'skip');
    expect(s.phase.id).toBe('question');
    expect(s.index).toBe(1);
    for (let i = 0; i < 8; i++) s = vip(s, 'skip'); // q2..q5 + their reveals
    expect(s.phase.id).toBe('wager');
  });

  it('wager → final question with the wagers placed so far (missing = 0)', () => {
    let s = toWager(start(), { a: true, b: true });
    s = wager(s, 'a', 50);
    const bet = s.wagers['a'];
    s = vip(s, 'skip');
    expect(s.phase.id).toBe('question');
    expect(s.index).toBe(s.questionIds.length - 1);
    expect(s.wagers).toEqual({ a: bet });
    // Skipping the final question loses the wager for a; b and c bet nothing.
    const before = { ...s.scores };
    s = vip(s, 'skip');
    expect(s.phase.id).toBe('reveal');
    expect(s.scores['a']).toBe((before['a'] ?? 0) - (bet ?? 0));
    expect(s.scores['b']).toBe(before['b']);
    s = vip(s, 'skip');
    expect(s.phase.id).toBe('done');
    expect(game.results(s)).not.toBeNull();
  });

  it('skip in done is a no-op', () => {
    let s = start();
    while (game.results(s) === null) s = vip(s, 'skip');
    expect(s.phase.id).toBe('done');
    expect(vip(s, 'skip')).toEqual(s);
  });
});

describe('VIP end and pause', () => {
  it.each(['question', 'wager'] as const)(
    'resume closes %s when the last unfinished phone dropped during pause',
    (phase) => {
      let s = phase === 'question' ? timer(start({ answerSeconds: 20 })) : toWager(start());
      s =
        phase === 'question'
          ? pick(pick(s, 'a', true), 'b', false)
          : wager(wager(s, 'a', 50), 'b', 0);
      const pausedAt = s.phase.startedAt + 2_000;
      s = vip(s, 'pause', pausedAt);
      s = game.reduce(s, {
        type: 'player',
        playerId: 'c',
        connected: false,
        now: pausedAt + 8_000,
      });
      expect(s.phase.id).toBe(phase);
      expect(s.phase.paused).toBeDefined();
      s = vip(s, 'resume', pausedAt + 10_000);
      expect(s.phase.id).toBe(phase === 'question' ? 'reveal' : 'question');
    },
  );

  it('resume still waits when an unfinished phone returns during the pause', () => {
    let s = pick(pick(timer(start()), 'a', true), 'b', false);
    const pausedAt = s.phase.startedAt + 2_000;
    s = vip(s, 'pause', pausedAt);
    s = game.reduce(s, { type: 'player', playerId: 'c', connected: false, now: pausedAt + 8_000 });
    s = game.reduce(s, { type: 'player', playerId: 'c', connected: true, now: pausedAt + 9_000 });
    s = vip(s, 'resume', pausedAt + 10_000);
    expect(s.phase.id).toBe('question');
    expect(pick(s, 'c', true, 13_000).phase.id).toBe('reveal');
  });

  it('end → done from any phase with the scores so far', () => {
    let s = timer(start());
    s = pick(s, 'a', true);
    s = pick(s, 'b', true);
    s = pick(s, 'c', true); // reveal, scored
    const scores = { ...s.scores };
    s = timer(s); // next question
    s = pick(s, 'a', true); // not yet revealed → not counted
    const ended = vip(s, 'end');
    expect(ended.phase.id).toBe('done');
    expect(game.results(ended)?.scores).toEqual(scores);
    expect(vip(start(), 'end').phase.id).toBe('done');
    expect(vip(toWager(start()), 'end').phase.id).toBe('done');
  });

  it('pause holds the deadline and ignores inputs/timers; resume shifts the deadline', () => {
    let s = timer(start({ answerSeconds: 10 }));
    const deadline = s.phase.deadline as number;
    s = vip(s, 'pause', s.phase.startedAt + 2_000);
    expect(s.phase.paused).toEqual({ at: s.phase.startedAt + 2_000 });
    expect(pick(s, 'a', true, 3_000)).toBe(s);
    expect(timer(s)).toBe(s);
    expect(tv(s).paused).toBe(true);
    s = vip(s, 'resume', s.phase.startedAt + 6_000);
    expect(s.phase.paused).toBeUndefined();
    expect(s.phase.deadline).toBe(deadline + 4_000);
    s = pick(s, 'a', true, 7_000);
    expect(s.picks['a']?.elapsedMs).toBe(3_000);
  });

  it('skip while paused resumes first, then advances', () => {
    let s = vip(timer(start()), 'pause');
    s = vip(s, 'skip');
    expect(s.phase.id).toBe('reveal');
    expect(s.phase.paused).toBeUndefined();
  });
});
