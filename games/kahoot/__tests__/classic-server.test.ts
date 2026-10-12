// Real reducer checks for the additive classic mode and the shared reading/timing repairs.
import { describe, expect, it } from 'vitest';
import { createRng, seedRng } from '@partybox/game-sdk';
import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { CLASSIC_KNOWLEDGE, CLASSIC_PACKS } from '../server/classic';
import { questionById, QUESTIONS, QUESTIONS_ES } from '../server/content';
import { drawClassicQuestions } from '../server/draw';
import { answerWindowOf, isFinalIndex, quizModeOf, readMs, wordCount } from '../server/types';
import type { Input, State } from '../server/types';
import { controllerView, tvView } from '../server/views';
import { revealMs } from '../server/phases/reveal';

const kit = testKit(game, { t0: 100_000 });
const players = [
  { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
  { id: 'b', name: 'Ben', avatarId: 'owl', connected: true },
  { id: 'c', name: 'Cleo', avatarId: 'frog', connected: true },
];
function start(settings: Record<string, string | number> = {}, seats = players): State {
  return game.init({
    players: seats,
    seed: 41,
    now: 100_000,
    settings: {
      quizMode: 'classic',
      classicPack: 'general',
      questions: 5,
      answerSeconds: 5,
      ...settings,
    },
  });
}
function stamp(s: State, index: number): Extract<Input, { type: 'answer' }> {
  return {
    type: 'answer',
    questionId: s.questionIds[s.index]!,
    questionStartedAt: s.phase.startedAt,
    index,
  };
}
function choose(s: State, id: string, correct = true, elapsed = 100): State {
  const q = questionById(s.questionIds[s.index]!, s.contentLang)!;
  const now = (s.answerClosesAt ?? s.phase.deadline!) - answerWindowOf(s) + elapsed;
  return kit.input(s, id, stamp(s, correct ? q.answerIndex : (q.answerIndex + 1) % 4), now);
}
function reveal(s: State, equalTimes = false): State {
  let next = s;
  players.forEach((p, i) => {
    next = choose(next, p.id, true, equalTimes ? 100 : 100 + i * 500);
  });
  return next.phase.id === 'question' ? kit.timer(next) : next;
}
function lastReveal(equalTimes = false): State {
  let s = kit.timer(start());
  for (let step = 0; step < 40 && s.index < s.questionIds.length - 1; step++)
    s = kit.timer(reveal(s, equalTimes));
  expect(s.index).toBe(s.questionIds.length - 1);
  return reveal(s, equalTimes);
}
function toWager(): State {
  let s = start({ quizMode: 'wager' });
  for (let steps = 0; s.phase.id !== 'wager' && steps < 30; steps++) s = kit.vip(s, 'skip');
  if (s.phase.id !== 'wager') throw new Error('wager traversal failed');
  return s;
}

describe('separate original classic packs', () => {
  it('keeps three exact twenty-question packs and matching answer-text facts', () => {
    const ids: string[] = [];
    for (const pack of Object.values(CLASSIC_PACKS)) {
      expect(pack.questions).toHaveLength(20);
      for (const q of pack.questions) {
        ids.push(q.id);
        expect(CLASSIC_KNOWLEDGE[q.id]).toBe(q.options[q.correct]);
      }
    }
    expect(new Set(ids).size).toBe(60);
    expect(Object.keys(CLASSIC_KNOWLEDGE)).toHaveLength(60);
    expect(QUESTIONS).toHaveLength(6153);
    expect(QUESTIONS_ES).toHaveLength(5561);
  });
  it.each(['general', 'movies', 'science'] as const)(
    'draws exactly twenty %s ids without an appended final',
    (pack) => {
      const [first] = drawClassicQuestions(seedRng(12), pack, 20);
      const [again] = drawClassicQuestions(seedRng(12), pack, 20);
      expect(first).toEqual(again);
      expect(first.ids).toHaveLength(20);
      expect(new Set(first.ids).size).toBe(20);
      expect(first.ids.every((id) => id.startsWith(`${pack}-`))).toBe(true);
    },
  );
  it('defaults absent modes to wager and pins the minigame', () => {
    const s = game.init({ players, seed: 1, now: 0, settings: {} });
    expect(quizModeOf(s)).toBe('wager');
    expect(s.questionIds).toHaveLength(11);
    expect(game.manifest.minigame?.settings?.quizMode).toBe('wager');
    const legacy: State = {
      ...s,
      settings: { questions: 10, answerSeconds: 15, category: 'all', subcategories: [] },
    };
    expect(tvView(legacy, 'kahoot').quizMode).toBe('wager');
  });
  it('keeps host Spanish metadata independent from English classic questions', () => {
    const s = game.init({
      players,
      seed: 1,
      now: 0,
      contentLang: 'es',
      settings: { quizMode: 'classic' },
    });
    expect(tvView(s, 'kahoot').contentLang).toBe('es');
    expect(tvView(s, 'kahoot').questionLang).toBe('en');
    expect(questionById(s.questionIds[0]!, 'es')).toBeDefined();
  });
});

describe('stamped answers and minimum reading holds', () => {
  it('ignores unstamped, wrong-id, wrong-opening, unknown, early and duplicate answers', () => {
    const s = kit.timer(start());
    const good = stamp(s, 0);
    expect(kit.input(s, 'a', { type: 'pick', index: 0 })).toBe(s);
    expect(kit.input(s, 'a', { ...good, type: 'answer', questionId: 'other' })).toBe(s);
    expect(
      kit.input(s, 'a', { ...good, type: 'answer', questionStartedAt: s.phase.startedAt - 1 }),
    ).toBe(s);
    expect(kit.input(s, '__proto__', good)).toBe(s);
    expect(kit.input(s, 'a', good, s.phase.startedAt - 1)).toBe(s);
    const first = choose(s, 'a');
    expect(choose(first, 'a', false)).toBe(first);
  });
  it('rejects an old question stamp even when its timestamp arrives inside the next window', () => {
    const first = kit.timer(start());
    const old = stamp(first, 0);
    const next = kit.timer(reveal(first));
    expect(next.index).toBe(1);
    expect(kit.input(next, 'a', old, next.phase.startedAt + 200)).toBe(next);
  });
  it('locks all picks immediately, holds the screen, and keeps settled speed elapsed values', () => {
    let s = kit.timer(start({ answerSeconds: 30 }));
    const end = s.answerClosesAt;
    players.forEach((p) => {
      s = choose(s, p.id, true, 100);
    });
    expect(s.phase.id).toBe('question');
    expect(s.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(s.phase.deadline).toBe(s.questionReadableUntil);
    expect(s.answerClosesAt).toBe(end);
    expect(Object.values(s.picks).every((p) => p.elapsedMs === 100)).toBe(true);
    expect(kit.timer(s, s.phase.deadline! - 1)).toBe(s);
    const judged = kit.timer(s);
    expect(judged.phase.id).toBe('reveal');
    expect(judged.picks).toEqual(s.picks);
    expect(judged.lastDelta.a).toBeGreaterThan(500);
  });
  it('restores the original window when an unanswered participant reconnects during a hold', () => {
    let s = kit.timer(start({ answerSeconds: 30 }));
    s = kit.player(s, 'b', false);
    s = choose(choose(s, 'a'), 'c');
    const hold = s.phase.deadline!;
    const end = s.answerClosesAt!;
    expect(hold).toBeLessThan(end);
    s = kit.player(s, 'b', true, undefined, s.phase.startedAt + 200);
    expect(s.phase.deadline).toBe(end);
    s = choose(s, 'b', true, 500);
    expect(s.picks.b?.elapsedMs).toBe(500);
    expect(s.phase.deadline).toBe(hold);
  });
  it('shifts private hold/end clocks on resume without charging paused time', () => {
    let s = kit.timer(start({ answerSeconds: 30 }));
    s = choose(s, 'a', true, 100);
    const end = s.answerClosesAt!;
    const min = s.questionReadableUntil!;
    s = kit.vip(s, 'pause', s.phase.startedAt + 200);
    expect(choose(s, 'b')).toBe(s);
    s = kit.vip(s, 'resume', s.phase.paused!.at + 4000);
    expect(s.answerClosesAt).toBe(end + 4000);
    expect(s.questionReadableUntil).toBe(min + 4000);
    s = choose(s, 'b', true, 300);
    expect(s.picks.a?.elapsedMs).toBe(100);
    expect(s.picks.b?.elapsedMs).toBe(300);
  });
  it('budgets the actual answer window and marks a deadline receipt too slow', () => {
    const s = kit.timer(start());
    expect(answerWindowOf(s)).toBeGreaterThan(5000);
    expect(controllerView(s, 'kahoot', 'a').worth?.windowMs).toBe(answerWindowOf(s));
    const judged = kit.input(s, 'a', stamp(s, 0), s.answerClosesAt!);
    expect(judged.phase.id).toBe('reveal');
    expect(judged.picks).toEqual({});
    expect(controllerView(judged, 'kahoot', 'a').outcome?.answered).toBe(false);
  });
});

describe('classic scoring, finale privacy and occupied podium tiers', () => {
  it.each(['wager', 'classic'] as const)(
    'keeps %s reveal clocks aligned when a streak starts and resets',
    (quizMode) => {
      let s = kit.timer(start({ quizMode, answerSeconds: 30 }));
      for (const correct of [true, true, false]) {
        const q = questionById(s.questionIds[s.index]!, s.contentLang)!;
        const index = correct ? q.answerIndex : (q.answerIndex + 1) % 4;
        const now = s.answerClosesAt! - answerWindowOf(s) + 100;
        for (const p of players) {
          const input: Input = quizMode === 'classic' ? stamp(s, index) : { type: 'pick', index };
          s = kit.input(s, p.id, input, now);
        }
        if (s.phase.id === 'question') s = kit.timer(s);
        expect(s.phase.id).toBe('reveal');
        expect(s.phase.deadline! - s.phase.startedAt).toBe(revealMs(s));
        const tv = tvView(s, 'kahoot');
        const phone = controllerView(s, 'kahoot', 'a');
        expect(tv.revealAt).toBe(s.phase.startedAt);
        expect(phone.revealAt).toBe(s.phase.startedAt);
        expect(tv.nextAt).toBe(tv.leaderboardAt);
        expect(phone.nextAt).toBe(tv.nextAt);
        const paused = kit.vip(s, 'pause', s.phase.startedAt + 100);
        const resumed = kit.vip(paused, 'resume', s.phase.startedAt + 4100);
        expect(tvView(resumed, 'kahoot').revealAt).toBe(s.phase.startedAt + 4000);
        expect(controllerView(resumed, 'kahoot', 'a').nextAt).toBe(tv.nextAt! + 4000);
        s = kit.timer(s);
      }
    },
  );
  it('holds the last classic chart until its own Next beat without exposing a scoreboard', () => {
    const s = lastReveal();
    const tv = tvView(s, 'kahoot');
    const phone = controllerView(s, 'kahoot', 'a');
    expect(tv.next).toBe('podium');
    expect(tv.nextAt).toBe(s.phase.deadline);
    expect(phone.nextAt).toBe(tv.nextAt);
    expect(controllerView(s, 'kahoot', 'spectator').stage?.nextAt).toBe(tv.nextAt);
    expect(tv.nextAt! - tv.revealAt!).toBeGreaterThan(2300);
    expect(tv).not.toHaveProperty('leaderboardAt');
    expect(phone).not.toHaveProperty('leaderboardAt');
    const paused = kit.vip(s, 'pause', s.phase.startedAt + 100);
    const resumed = kit.vip(paused, 'resume', s.phase.startedAt + 4100);
    expect(tvView(resumed, 'kahoot').nextAt).toBe(tv.nextAt! + 4000);
    expect(tvView(resumed, 'kahoot')).not.toHaveProperty('standings');
  });
  it('budgets the phone podium stage together with its unveiled personal streak receipt', () => {
    const s = kit.timer(lastReveal());
    const tv = tvView(s, 'kahoot');
    const row = tv.podium!.entries[0]!;
    const receipt = `The podium Third place ${row.name} ${row.score} points 2nd 1st 3rd Place ${row.rank} ${row.score} points ${s.streaks[row.playerId]} correct in a row`;
    expect(s.streaks[row.playerId]).toBe(5);
    expect(s.phase.deadline! - s.phase.startedAt).toBeGreaterThanOrEqual(
      readMs(wordCount(receipt)),
    );
  });
  it('uses ordinary final-question points and chart, then only unveils third, second, first', () => {
    let s = lastReveal();
    expect(isFinalIndex(s, s.index)).toBe(false);
    expect(s.lastDelta.a).toBeGreaterThan(500);
    const receipt = controllerView(s, 'kahoot', 'a').outcome!;
    expect(receipt.bonus).toBe(300);
    expect(receipt.base! + receipt.bonus!).toBe(receipt.delta);
    const final = tvView(s, 'kahoot');
    expect(final.round).toMatchObject({ number: 5, total: 5, final: false, last: true });
    expect(final.answerDistribution?.counts.reduce((n, x) => n + x, 0)).toBe(3);
    expect(final).not.toHaveProperty('rows');
    expect(final).not.toHaveProperty('standings');
    expect(final.players.every((p) => !Object.hasOwn(p, 'score'))).toBe(true);
    expect(controllerView(s, 'kahoot', 'a')).not.toHaveProperty('myRank');
    expect(game.results(s)).toBeNull();
    for (const rank of [3, 2, 1]) {
      s = kit.timer(s);
      const v = tvView(s, 'kahoot');
      expect(s.phase.id).toBe('podium');
      expect(v.podium?.rank).toBe(rank);
      expect(v.podium?.entries.every((row) => row.rank >= rank)).toBe(true);
      expect(v).not.toHaveProperty('rows');
      expect(v).not.toHaveProperty('standings');
      expect(v.players.every((p) => !Object.hasOwn(p, 'score'))).toBe(true);
      expect(game.results(s)).toBeNull();
    }
    s = kit.timer(s);
    expect(s.phase.id).toBe('done');
    expect(game.results(s)?.winnerIds).toEqual(['a']);
    expect(tvView(s, 'kahoot').standings).toHaveLength(3);
    expect(controllerView(s, 'kahoot', 'spectator')).not.toHaveProperty('myRank');
  });
  it('shares tied ranks and skips empty podium tiers', () => {
    let s = kit.timer(lastReveal(true));
    expect(tvView(s, 'kahoot').podium).toMatchObject({ rank: 1, revealedRanks: [1] });
    expect(tvView(s, 'kahoot').podium?.entries).toHaveLength(3);
    s = kit.timer(s);
    expect(s.phase.id).toBe('done');
    expect(game.results(s)?.winnerIds).toEqual(['a', 'b', 'c']);
  });
  it('shows a public stage without reactivating a permanent departure', () => {
    let s = kit.timer(start());
    s = kit.player(s, 'b', false, 'left', s.phase.startedAt + 100);
    s = kit.player(s, 'b', true, undefined, s.phase.startedAt + 200);
    const v = controllerView(s, 'kahoot', 'b');
    expect(v.me.role).toBe('player');
    expect(v.participating).toBe(false);
    expect(v.showStage).toBe(true);
    expect(v.stage?.question).not.toBeNull();
    expect(choose(s, 'b')).toBe(s);
    expect(controllerView(s, 'kahoot', 'spectator').showStage).toBe(true);
    expect(controllerView(s, 'kahoot', 'a').question).toBeNull();
  });
  it('keeps temporary disconnects eligible and supplies remote stage data in both modes', () => {
    for (const quizMode of ['wager', 'classic']) {
      let s = kit.timer(
        start(
          { quizMode },
          players.map((p) => ({ ...p, canSeeTv: false })),
        ),
      );
      s = kit.player(s, 'a', false);
      expect(controllerView(s, 'kahoot', 'a').participating).toBe(true);
      expect(controllerView(s, 'kahoot', 'a').stage?.question).not.toBeNull();
    }
  });
  it('emits stamped classic bot answers from the authored answer-text knowledge', () => {
    const s = kit.timer(start());
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      const answer = game.bot.sampleInput(s, 'a', createRng(7), skill);
      expect(answer).toMatchObject({
        type: 'answer',
        questionId: s.questionIds[0],
        questionStartedAt: s.phase.startedAt,
      });
      expect(game.inputSchema.safeParse(answer).success).toBe(true);
    }
  });
});

describe('wager receipt contract repair', () => {
  it('rejects disconnected/early wagers and advances late receipts without recording them', () => {
    const s = toWager();
    const value: Input = { type: 'wager', percent: 100 };
    expect(kit.input(s, 'a', value, s.phase.startedAt - 1)).toBe(s);
    const disconnected = kit.player(s, 'a', false);
    expect(kit.input(disconnected, 'a', value)).toBe(disconnected);
    const late = kit.input(s, 'a', value, s.wagerClosesAt!);
    expect(late.phase.id).toBe('question');
    expect(late.wagers).toEqual({});
  });
});
