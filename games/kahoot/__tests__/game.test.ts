// Pin player-visible rules, boundary timestamps, pause accounting and hidden information.
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { botInput } from '../server/bot';
import { currentQuestion } from '../server/content';
import { speedPoints } from '../server/scoring';
import type { State } from '../server/types';

const kit = testKit(game, { players: testPlayers(2), settings: { rounds: 5 } });
const answer = (s: State, id: string, choice = currentQuestion(s).correct, elapsed = 1000): State =>
  kit.input(s, id, { type: 'answer', round: s.round, choice }, s.openedAt + elapsed);
const correctRound = (s: State): State => answer(answer(s, 'p1'), 'p2');

describe('scoring', () => {
  it('awards 1000 at zero, 750 halfway and 500 at the end; clamps both ends', () => {
    expect(speedPoints(0, 20_000)).toBe(1000);
    expect(speedPoints(10_000, 20_000)).toBe(750);
    expect(speedPoints(20_000, 20_000)).toBe(500);
    expect(speedPoints(-500, 20_000)).toBe(1000);
    expect(speedPoints(40_000, 20_000)).toBe(500);
  });
  it('rounds speed points to the nearest integer', () => {
    expect(speedPoints(1037, 20_000)).toBe(974);
  });
  it('wrong answers and timeouts score zero and break streaks', () => {
    let s = correctRound(kit.start());
    s = kit.timer(kit.timer(s));
    s = answer(s, 'p1', (currentQuestion(s).correct + 1) % 4);
    s = kit.timer(s);
    expect(s.verdicts.p1).toMatchObject({ outcome: 'wrong', points: 0, streak: 0, bonus: 0 });
    expect(s.verdicts.p2).toMatchObject({ outcome: 'timeout', points: 0, streak: 0 });
  });
  it('builds streaks by 100 up to 500 and credits exactly once', () => {
    const longKit = testKit(game, { players: testPlayers(2), settings: { rounds: 10 } });
    let s = longKit.start();
    for (let r = 1; r <= 7; r++) {
      s = correctRound(s);
      expect(s.verdicts.p1!.bonus).toBe(Math.min(500, (r - 1) * 100));
      expect(s.verdicts.p1!.points).toBe(975 + Math.min(500, (r - 1) * 100));
      const scored = s.scores.p1;
      s = kit.timer(s);
      expect(s.scores.p1).toBe(scored);
      s = kit.timer(s);
    }
  });
  it('keeps equal scores at the same rank', () => {
    const s = kit.until(correctRound(kit.start()), 'done');
    expect(game.results(s)!.ranking.map((r) => r.rank)).toEqual([1, 1]);
    expect(game.results(s)!.winnerIds).toEqual(['p1', 'p2']);
  });
});

describe('one tap per question', () => {
  it('starts in question directly after the shell countdown', () => {
    const s = kit.start();
    expect(s.phase.id).toBe('question');
    expect(s.answerMs).toBe(20_000);
    expect(s.phase.deadline).toBe(s.openedAt + s.answerMs);
  });
  it('locks first answer, ignores duplicates and round-stale answers', () => {
    const s = answer(kit.start(), 'p1', 1);
    expect(answer(s, 'p1', 2)).toBe(s);
    expect(kit.input(s, 'p2', { type: 'answer', round: 2, choice: 1 })).toBe(s);
    expect(s.answers.p1!.choice).toBe(1);
  });
  it('rejects unknown/prototype senders, pre-start and disconnected taps', () => {
    const s = kit.start();
    for (const id of ['ghost', '', '__proto__', 'constructor']) expect(answer(s, id)).toBe(s);
    expect(answer(s, 'p1', 0, -1)).toBe(s);
    const dropped = kit.player(s, 'p1', false);
    expect(answer(dropped, 'p1')).toBe(dropped);
  });
  it('closes immediately on the last connected answer, not on the first', () => {
    const s = answer(kit.start(), 'p1');
    expect(s.phase.id).toBe('question');
    expect(answer(s, 'p2').phase.id).toBe('reveal');
  });
  it('rejects a tap exactly at or past the deadline before scoring it', () => {
    const s = kit.start();
    const out = answer(s, 'p1', currentQuestion(s).correct, s.answerMs);
    expect(out.phase.id).toBe('reveal');
    expect(out.answers).toEqual({});
    expect(out.verdicts.p1!.outcome).toBe('timeout');
  });
  it('ignores stale and premature timers in every phase, including podium beats', () => {
    let s = kit.start();
    for (let i = 0; i < 30 && s.phase.id !== 'done'; i++) {
      expect(
        kit.reduce(s, {
          type: 'timer',
          now: s.phase.deadline!,
          phaseId: s.phase.id,
          startedAt: s.phase.startedAt - 1,
        }),
      ).toBe(s);
      expect(kit.timer(s, s.phase.startedAt)).toBe(s);
      s = kit.timer(s);
    }
    expect(s.phase.id).toBe('done');
  });
  it('resumes a refreshed player with their answer intact; a drop never blocks the rest', () => {
    let s = answer(kit.start(), 'p1', 2);
    s = kit.player(s, 'p1', false);
    s = kit.player(s, 'p1', true);
    expect(game.controllerView(s, 'p1')).toMatchObject({ submitted: true, selected: 2 });
    s = kit.player(s, 'p2', false);
    expect(s.phase.id).toBe('reveal');
  });
  it('all disconnected moves to reveal and keeps every departed seat in results', () => {
    let s = kit.player(kit.start(), 'p1', false, 'left');
    s = kit.player(s, 'p2', false, 'kicked');
    expect(s.phase.id).toBe('reveal');
    const res = game.results(kit.until(s, 'done'))!;
    expect(Object.keys(res.scores)).toEqual(['p1', 'p2']);
    expect(res.ranking).toHaveLength(2);
  });
});

describe('pause and pacing', () => {
  it('holds inputs and timers; pause time earns no speed points', () => {
    let s = kit.start();
    const opened = s.openedAt;
    const deadline = s.phase.deadline!;
    s = kit.vip(s, 'pause', s.openedAt + 1000);
    expect(answer(s, 'p1')).toBe(s);
    expect(kit.timer(s)).toBe(s);
    s = kit.vip(s, 'resume', s.openedAt + 6000);
    expect(s.phase.deadline).toBe(deadline + 5000);
    s = kit.input(
      s,
      'p1',
      { type: 'answer', round: s.round, choice: currentQuestion(s).correct },
      opened + 7000,
    );
    s = kit.input(
      s,
      'p2',
      { type: 'answer', round: s.round, choice: currentQuestion(s).correct },
      opened + 7000,
    );
    expect(s.verdicts.p1!.base).toBe(950);
  });
  it('a paused drop is rechecked on resume, and a leave cannot rejoin the match', () => {
    let s = answer(kit.start(), 'p1');
    s = kit.vip(s, 'pause');
    s = kit.player(s, 'p2', false, 'left');
    expect(s.phase.id).toBe('question');
    s = kit.vip(s, 'resume', s.openedAt + 8000);
    expect(s.phase.id).toBe('reveal');
    s = kit.timer(kit.timer(s));
    s = kit.player(s, 'p2', true);
    expect(answer(s, 'p2')).toBe(s);
  });
  it('VIP skips every phase and end remains terminal', () => {
    let s = kit.start();
    for (let i = 0; i < 30 && s.phase.id !== 'done'; i++) s = kit.vip(s, 'skip');
    expect(s.phase.id).toBe('done');
    expect(kit.vip(s, 'pause')).toBe(s);
    expect(kit.vip(s, 'end')).toBe(s);
    expect(kit.vip(kit.start(), 'end').phase.id).toBe('done');
  });
  it('reserves slow-reader time and goes from final reveal directly to podium', () => {
    const q = kit.start();
    const reveal = kit.timer(q);
    expect(reveal.phase.deadline! - reveal.phase.startedAt).toBeGreaterThanOrEqual(4500);
    const final = { ...reveal, round: reveal.deck.length };
    expect(kit.timer(final).phase.id).toBe('podium');
  });
});

describe('views and bots', () => {
  it('the question views are identical when the key, explanation or other answers change', () => {
    const s = answer(kit.start(), 'p1', 0);
    const q = currentQuestion(s);
    const changed = {
      ...s,
      deck: s.deck.map((v, i) =>
        i === 0 ? { ...v, correct: (q.correct + 1) % 4, explanation: 'SECRET ONLY' } : v,
      ),
      answers: { ...s.answers, p1: { choice: 3, elapsed: 9999 } },
    };
    expect(game.tvView(changed)).toEqual(game.tvView(s));
    expect(game.controllerView(changed, 'p2')).toEqual(game.controllerView(s, 'p2'));
    expect(JSON.stringify(game.tvView(s))).not.toContain('correct');
    expect(JSON.stringify(game.controllerView(s, 'p2'))).not.toContain('elapsed');
  });
  it('TV phones carry no prompt or options; phone-only, remote and spectators get the stage', () => {
    const s = kit.start();
    expect(game.controllerView(s, 'p1').question).toBeNull();
    expect(game.controllerView({ ...s, phoneOnly: true }, 'p1').question).not.toBeNull();
    const remote = { ...s, players: { ...s.players, p1: { ...s.players.p1!, canSeeTv: false } } };
    expect(game.controllerView(remote, 'p1').stage).toBe(true);
    expect(game.controllerView(s, '__proto__').me.role).toBe('spectator');
  });
  it('reveals the correct shape and accurate four bars, including missed seats', () => {
    let s = answer(kit.start(), 'p1', 3);
    s = kit.timer(s);
    expect(game.tvView(s).reveal).toMatchObject({
      correctChoice: currentQuestion(s).correct,
      counts: [0, 0, 0, 1],
      missed: 1,
    });
    expect(game.controllerView(s, 'p1').verdict).toEqual(s.verdicts.p1);
  });
  it('gates podium rank tiers on server time, including tied winners', () => {
    const eight = testKit(game, { players: testPlayers(8) });
    let s = eight.until(eight.start(), 'podium');
    s = {
      ...s,
      podiumStep: 0,
      scores: Object.fromEntries(testPlayers(8).map((p, i) => [p.id, (8 - i) * 100])),
    };
    expect(game.tvView(s).standings.map((r) => r.rank)).toEqual([3]);
    expect(game.controllerView(s, 'p1').rank).toBe(0);
    s = eight.timer(s);
    expect(game.tvView(s).standings.map((r) => r.rank)).toEqual([2, 3]);
    s = eight.timer(s);
    expect(game.tvView(s).standings.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(game.controllerView(s, 'p1').rank).toBe(1);
    expect(eight.timer(s).phase.id).toBe('done');
  });
  it('skips empty podium tiers and does not spoil final ranks on the reveal phone', () => {
    const final = kit.until(kit.start(), 'podium');
    expect(final.podiumStep).toBe(2);
    expect(kit.timer(final).phase.id).toBe('done');
    const s = correctRound({ ...kit.start(), round: 5 });
    expect(game.controllerView(s, 'p1').rank).toBe(0);
  });
  it('starts later unanswered questions without a wait when no eligible seat remains', () => {
    const s = kit.player(kit.player(kit.start(), 'p1', false), 'p2', false);
    expect(s.phase.id).toBe('reveal');
    const next = kit.timer(kit.timer(s));
    expect(next.phase.id).toBe('reveal');
    expect(next.round).toBe(2);
    expect(Object.values(next.verdicts).every((v) => v.outcome === 'timeout')).toBe(true);
  });
  it('bot decisions never read a changed shuffled key and vary by skill', () => {
    const s = kit.start();
    const changed = { ...s, deck: s.deck.map((q) => ({ ...q, correct: (q.correct + 1) % 4 })) };
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      expect(botInput(s, 'p1', createRng(12), skill)).toEqual(
        botInput(changed, 'p1', createRng(12), skill),
      );
    }
    const accuracy = (skill: 'easy' | 'sharp'): number => {
      let n = 0;
      for (let seed = 1; seed <= 1000; seed++)
        if (botInput(s, 'p1', createRng(seed), skill)?.choice === currentQuestion(s).correct) n++;
      return n;
    };
    expect(accuracy('sharp')).toBeGreaterThan(accuracy('easy') * 2);
    expect(botInput(s, 'ghost', createRng(1))).toBeNull();
    expect(botInput(answer(s, 'p1'), 'p1', createRng(1))).toBeNull();
  });
  it('bot confidence depends only on public wording and authored knowledge', () => {
    const s = kit.start();
    const metadata = { ...s, deck: s.deck.map((q) => ({ ...q, difficulty: 3 as const })) };
    for (let seed = 1; seed <= 100; seed++)
      expect(botInput(metadata, 'p1', createRng(seed))).toEqual(botInput(s, 'p1', createRng(seed)));
  });
});
