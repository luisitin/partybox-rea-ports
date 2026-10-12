// Flow + input rules from README.md: the draw, phase order, one pick per player, spectators,
// disconnects, hidden information. Scoring lives in scoring.test.ts, VIP actions in vip.test.ts.
import { describe, expect, it } from 'vitest';
import { QUESTIONS, questionById, questionsIn } from '../server/content';
import { drawQuestions } from '../server/draw';
import { game } from '../server/index';
import { revealMs } from '../server/phases/reveal';
import { seedRng } from '@partybox/game-sdk';
import {
  PLAYERS,
  T0,
  current,
  input,
  phone,
  pick,
  playQuestion,
  start,
  timer,
  toWager,
  tv,
} from './helpers';

describe('draw', () => {
  it('draws questions + 1 ids without repeats, deterministically per seed', () => {
    const [a] = drawQuestions(seedRng(7), 'all', 10);
    const [b] = drawQuestions(seedRng(7), 'all', 10);
    const [c] = drawQuestions(seedRng(8), 'all', 10);
    expect(a.ids).toHaveLength(11);
    expect(new Set(a.ids).size).toBe(11);
    expect(a).toEqual(b);
    expect(c.ids).not.toEqual(a.ids);
    expect(a.drawnFrom).toBe('all');
    for (const id of a.ids) expect(questionById(id)).toBeDefined();
  });

  it('honours the category setting when it has enough questions', () => {
    const s = start({ category: 'stem', questions: 20 });
    expect(s.drawnFrom).toBe('stem');
    expect(s.questionIds).toHaveLength(21);
    for (const id of s.questionIds) expect(questionById(id)?.category).toBe('stem');
  });

  it('falls back to all categories when the category is too small or unknown', () => {
    const [small] = drawQuestions(seedRng(1), 'stem', questionsIn('stem').length);
    expect(small.drawnFrom).toBe('all');
    expect(small.ids).toHaveLength(questionsIn('stem').length + 1);
    expect(start({ category: 'astrology' }).drawnFrom).toBe('all');
  });

  it('honours ticked topics, and falls back to the category, then all (ADR-034)', () => {
    const s = start({ category: 'sports', subcategories: 'hockey,soccer', questions: 20 });
    expect(s.settings.subcategories).toEqual(['hockey', 'soccer']);
    expect(s.drawnFrom).toBe('sports');
    expect(s.drawnSubs).toEqual(['hockey', 'soccer']);
    for (const id of s.questionIds)
      expect(['hockey', 'soccer']).toContain(questionById(id)?.subcategory);
    expect(tv(s).categoryLabel).toBe('Sports · Hockey, Soccer');
    // Topics from another category, unknown topics and blanks are dropped at init.
    const mixed = start({ category: 'sports', subcategories: 'math, soccer,,nope' });
    expect(mixed.settings.subcategories).toEqual(['soccer']);
    expect(start({ category: 'all', subcategories: 'soccer' }).settings.subcategories).toEqual([]);
    // A topic too small for the game falls back to its whole category.
    const n = questionsIn('sports', ['hockey']).length;
    const [fallback] = drawQuestions(seedRng(2), 'sports', n, ['hockey']);
    expect(fallback.drawnFrom).toBe('sports');
    expect(fallback.drawnSubs).toEqual([]);
    expect(fallback.ids).toHaveLength(n + 1);
    expect(start({ category: 'sports' }).drawnSubs).toEqual([]);
  });

  it('prefers the hardest available difficulty for the final question', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const [draw] = drawQuestions(seedRng(seed), 'all', 5);
      expect(questionById(draw.ids[5] ?? '')?.difficulty).toBe('hard');
    }
    // A pool where no hard question is left for the final falls back to medium, then easy.
    const easyOnly = QUESTIONS.filter((q) => q.difficulty === 'easy').length;
    expect(easyOnly).toBeGreaterThan(5);
  });
});

describe('phase flow', () => {
  it('starts in intro with a 4 s deadline and results null', () => {
    const s = start();
    expect(s.phase).toEqual({ id: 'intro', startedAt: T0, deadline: T0 + 2_000 }); // ADR-053: a title beat
    expect(s.index).toBe(-1);
    expect(game.results(s)).toBeNull();
    expect(s.scores).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('intro deadline → question 1 with the answerSeconds deadline', () => {
    const s = timer(start({ answerSeconds: 20 }));
    expect(s.phase.id).toBe('question');
    expect(s.index).toBe(0);
    expect(s.phase.deadline).toBe(s.phase.startedAt + 20_000);
  });

  it('runs questions → wager → final question → done, with every phase deadlined', () => {
    let s = timer(start({ questions: 5 }));
    const seen: string[] = [];
    let guard = 0;
    while (game.results(s) === null && guard++ < 100) {
      seen.push(s.phase.id);
      expect(s.phase.deadline, `phase ${s.phase.id} has no deadline`).not.toBeNull();
      s = timer(s);
    }
    expect(s.phase.id).toBe('done');
    expect(s.phase.deadline).toBeNull();
    expect(seen.filter((p) => p === 'question')).toHaveLength(6);
    expect(seen.filter((p) => p === 'reveal')).toHaveLength(6);
    expect(seen.indexOf('wager')).toBe(seen.lastIndexOf('wager'));
    expect(seen.slice(-3)).toEqual(['wager', 'question', 'reveal']);
    expect(s.phase.startedAt).toBe(s.phase.startedAt);
    expect(seen[0]).toBe('question');
  });

  it('moves to reveal as soon as every connected player picked', () => {
    let s = timer(start());
    s = pick(s, 'a', true);
    s = pick(s, 'b', false);
    expect(s.phase.id).toBe('question');
    s = pick(s, 'c', true);
    expect(s.phase.id).toBe('reveal');
    // I-589 + the pacing rule: a regular reveal holds long enough to read every row, >= 8 s
    expect(s.phase.deadline).toBe(s.phase.startedAt + revealMs(s));
    expect(revealMs(s)).toBeGreaterThanOrEqual(8_000);
  });

  it('the wager phase lasts 15 s and ends early once everyone wagered', () => {
    const s = toWager(start());
    expect(s.phase.deadline).toBe(s.phase.startedAt + 15_000);
    let t = s;
    for (const id of ['a', 'b', 'c'])
      t = input(t, id, { type: 'wager', percent: 0 }, t.phase.startedAt + 1);
    expect(t.phase.id).toBe('question');
    expect(t.index).toBe(t.questionIds.length - 1);
    expect(tv(t).round).toEqual({ number: 6, total: 5, final: true });
    // The wager screen shows the standings players are betting from.
    expect(tv(s).standings?.map((r) => r.playerId)).toEqual(['a', 'b', 'c']);
    expect(tv(s).standings?.[0]?.rank).toBe(1);
  });
});

describe('inputs', () => {
  it('a second pick from the same player is ignored', () => {
    let s = timer(start());
    const q = current(s);
    s = input(s, 'a', { type: 'pick', index: q.answerIndex }, s.phase.startedAt + 500);
    const again = input(
      s,
      'a',
      { type: 'pick', index: (q.answerIndex + 1) % 4 },
      s.phase.startedAt + 900,
    );
    expect(again).toBe(s);
    expect(again.picks['a']).toEqual({ index: q.answerIndex, elapsedMs: 500 });
  });

  it('ignores spectators, unknown ids, __proto__, wrong-phase and wrong-type inputs', () => {
    const s = timer(start());
    expect(input(s, 'zed', { type: 'pick', index: 0 }, T0 + 5_000)).toBe(s);
    expect(input(s, '__proto__', { type: 'pick', index: 0 }, T0 + 5_000)).toBe(s);
    expect(input(s, 'a', { type: 'wager', percent: 50 }, T0 + 5_000)).toBe(s);
    const intro = start();
    expect(input(intro, 'a', { type: 'pick', index: 1 }, T0 + 100)).toBe(intro);
    const w = toWager(start());
    expect(input(w, 'a', { type: 'pick', index: 1 }, w.phase.startedAt + 100)).toBe(w);
    expect(input(w, 'ghost', { type: 'wager', percent: 0 }, w.phase.startedAt + 100)).toBe(w);
  });

  it('a disconnected player does not block "all answered"; reconnecting lets them answer', () => {
    let s = timer(start());
    s = game.reduce(s, { type: 'player', now: T0 + 4_100, playerId: 'c', connected: false });
    s = pick(s, 'a', true);
    s = pick(s, 'b', true);
    expect(s.phase.id).toBe('reveal');
    // Next question: c comes back and answers before the deadline.
    s = timer(s);
    s = game.reduce(s, {
      type: 'player',
      now: s.phase.startedAt + 100,
      playerId: 'c',
      connected: true,
    });
    s = pick(s, 'c', true, 2_000);
    expect(s.picks['c']).toEqual({ index: current(s).answerIndex, elapsedMs: 2_000 });
    expect(s.phase.id).toBe('question');
  });

  it('a stale timer is ignored', () => {
    const s = timer(start());
    const stale = game.reduce(s, {
      type: 'timer',
      now: s.phase.startedAt + 1,
      phaseId: 'question',
      startedAt: s.phase.startedAt - 1,
    });
    expect(stale).toBe(s);
  });

  it('works with a single player', () => {
    let s = timer(start({}, 3, PLAYERS.slice(0, 1)));
    s = pick(s, 'a', true);
    expect(s.phase.id).toBe('reveal');
    expect(s.scores['a']).toBeGreaterThan(0);
  });

  it('clamps settings and defaults unknown ones', () => {
    const s = start({ questions: 99, answerSeconds: 1, category: 'nope' });
    expect(s.settings).toEqual({
      questions: 20,
      answerSeconds: 5,
      category: 'all',
      subcategories: [],
    });
    const d = game.init({ players: PLAYERS, settings: {}, seed: 1, now: T0 });
    expect(d.settings).toEqual({
      questions: 10,
      answerSeconds: 15,
      category: 'all',
      subcategories: [],
    });
  });
});

describe('hidden information', () => {
  it('the correct index and picks are absent from every view until reveal', () => {
    let s = timer(start());
    s = pick(s, 'a', true);
    const tvText = JSON.stringify(tv(s));
    expect(tvText).not.toContain('correctIndex');
    expect(tvText).not.toContain('pickIndex');
    expect(tv(s).answeredCount).toBe(1);
    const other = phone(s, 'b');
    expect(JSON.stringify(other)).not.toContain('correctIndex');
    expect(other.myPickIndex).toBeNull();
    expect(phone(s, 'a').myPickIndex).toBe(current(s).answerIndex);
    // In reveal the TV shows everything.
    s = pick(pick(s, 'b', false), 'c', true);
    const reveal = tv(s);
    expect(reveal.correctIndex).toBe(current(s).answerIndex);
    expect(reveal.rows?.map((r) => r.playerId)).toEqual(['a', 'c', 'b']);
    expect(phone(s, 'b').outcome).toEqual({ correct: false, delta: 0 });
  });

  it('wagers stay hidden from the TV and other phones until the final reveal', () => {
    let s = toWager(start());
    s = input(s, 'a', { type: 'wager', percent: 0 }, s.phase.startedAt + 1);
    expect(JSON.stringify(tv(s))).not.toContain('wagerAmount');
    expect(tv(s).answeredCount).toBe(1);
    expect(phone(s, 'a').myWagerAmount).toBe(0);
    expect(phone(s, 'b').myWagerAmount).toBeUndefined();
    expect(JSON.stringify(phone(s, 'b'))).not.toContain('wagerAmount');
    s = timer(s); // final question
    expect(JSON.stringify(tv(s))).not.toContain('wagerAmount');
    s = timer(s); // final reveal
    expect(tv(s).rows?.find((r) => r.playerId === 'a')?.wagerAmount).toBe(0);
  });

  it('views never throw for spectators and unknown ids in any phase', () => {
    let s = start();
    for (let i = 0; i < 40 && game.results(s) === null; i++) {
      for (const id of ['a', 'zzz', '', '__proto__']) {
        expect(() => phone(s, id)).not.toThrow();
        expect(typeof phone(s, id).myScore).toBe('number');
      }
      expect(() => tv(s)).not.toThrow();
      s = s.phase.id === 'question' ? playQuestion(s, { a: true }) : timer(s);
    }
    expect(game.results(s)).not.toBeNull();
  });
});
