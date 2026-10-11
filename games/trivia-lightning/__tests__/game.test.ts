// Rule and abuse tests use explicit verdicts rather than a second copy of the reducer.
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { finishGame, testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { answerPoints } from '../server/scoring';
import { PACKS } from '../server/content';
import { KNOWLEDGE } from '../server/knowledge';
import { questionPackSchema } from '../content/schema';
import type { State } from '../server/types';

const kit = testKit(game, { players: testPlayers(2), settings: { questions: 6 }, t0: 1000 });
function answer(s: State, id = 'p1', correct = true, now = s.clock + 10): State {
  const i = s.runners[id]!.answered;
  const q = s.deck[i]!;
  return kit.input(
    s,
    id,
    {
      type: 'answer',
      questionId: q.id,
      index: i,
      choice: correct ? q.correctIndex : (q.correctIndex + 1) % 4,
    },
    now,
  );
}
function next(s: State, id = 'p1'): State {
  return kit.input(s, id, { type: 'next', index: s.runners[id]!.answered }, s.clock + 10);
}
function three(): State {
  let s = kit.start();
  for (let i = 0; i < 3; i++) s = next(answer(s));
  return s;
}
function power(s: State, power: 'freeze' | 'double', target?: string): State {
  return kit.input(
    s,
    'p1',
    { type: 'power', power, ...(target === undefined ? {} : { target }) },
    s.clock + 10,
  );
}

describe('knowledge scoring', () => {
  it('starts at 100, grows a modest streak, caps, resets on a miss', () => {
    expect([1, 2, 3, 4, 50].map((n) => answerPoints(true, n, false))).toEqual([
      100, 120, 140, 160, 160,
    ]);
    expect(answerPoints(false, 5, true)).toBe(0);
    let s = three();
    expect(s.runners.p1).toMatchObject({
      answered: 3,
      correct: 3,
      score: 360,
      streak: 3,
      energy: 1,
    });
    s = next(answer(s, 'p1', false));
    expect(s.runners.p1).toMatchObject({ correct: 3, score: 360, streak: 0 });
    expect(answer(s).runners.p1).toMatchObject({ score: 460, streak: 1 });
  });
  it('doubles the next correct answer, preserves it across a miss, consumes energy once', () => {
    let s = power(three(), 'double');
    expect(s.runners.p1).toMatchObject({ energy: 0, double: true });
    expect(power(s, 'double')).toBe(s);
    s = next(answer(s, 'p1', false));
    expect(s.runners.p1!.double).toBe(true);
    s = answer(s);
    expect(s.runners.p1).toMatchObject({ score: 560, double: false });
  });
  it('energy is capped at one and powers off never award or spend any', () => {
    let s = kit.start({ settings: { questions: 20 } });
    for (let i = 0; i < 6; i++) {
      s = next(answer(s));
      if (i < 2) expect(s.runners.p1!.energy).toBe(0);
    }
    expect(s.runners.p1!.energy).toBe(1);
    s = kit.start({ settings: { powers: false } });
    for (let i = 0; i < 3; i++) s = next(answer(s));
    expect(s.runners.p1!.energy).toBe(0);
    expect(power(s, 'double')).toBe(s);
  });
  it('does not weight the same fact by speed', () => {
    const s = kit.start();
    expect(answer(s, 'p1', true, 1100).runners.p1!.score).toBe(
      answer(s, 'p1', true, 9000).runners.p1!.score,
    );
  });
});

describe('independent cursors and hidden information', () => {
  it('one answer advances one seat, gives own feedback, leaves others on their own question', () => {
    const before = kit.start();
    const q = before.deck[0]!;
    const s = answer(before);
    expect(before.runners.p1!.answered).toBe(0);
    expect(s.runners.p2!.answered).toBe(0);
    expect(game.controllerView(s, 'p1').feedback).toMatchObject({
      correct: true,
      points: 100,
      answer: q.options[q.correctIndex],
    });
    expect(game.controllerView(s, 'p1').question).toBeNull();
    expect(game.controllerView(s, 'p2').feedback).toBeNull();
    expect(game.controllerView(s, 'p2').question!.index).toBe(0);
    expect(game.controllerView(next(s), 'p1').question!.index).toBe(1);
  });
  it('does not disclose answer keys, the deck, another question, or another verdict', () => {
    let s = next(answer(kit.start()));
    const tv = JSON.stringify(game.tvView(s));
    expect(tv).not.toMatch(/correctIndex|deck|question|feedback|explanation/);
    expect(tv).not.toContain(s.deck[1]!.prompt);
    const cv = game.controllerView(s, 'p2');
    expect(cv.question!.prompt).toBe(s.deck[0]!.prompt);
    expect(JSON.stringify(cv)).not.toMatch(/correctIndex|deck|runners/);
    expect(JSON.stringify(cv)).not.toContain(s.deck[1]!.prompt);
    s = answer(s, 'p1');
    expect(game.controllerView(s, 'p2').feedback).toBeNull();
    for (const id of ['spectator', '__proto__', 'constructor', '']) {
      expect(game.controllerView(s, id).me.role).toBe('spectator');
      expect(game.controllerView(s, id).question).toBeNull();
      expect(game.controllerView(s, id).feedback).toBeNull();
    }
  });
  it('rejects a duplicate, stale question id, stale cursor and incorrect Next cursor', () => {
    const before = kit.start();
    const q = before.deck[0]!;
    const input = { type: 'answer' as const, questionId: q.id, index: 0, choice: q.correctIndex };
    let s = answer(before);
    expect(kit.input(s, 'p1', input, s.clock + 1)).toBe(s);
    expect(kit.input(s, 'p1', { ...input, questionId: s.deck[1]!.id, index: 1 }, s.clock + 1)).toBe(
      s,
    );
    expect(kit.input(s, 'p1', { type: 'next', index: 2 }, s.clock + 1)).toBe(s);
    s = next(s);
    expect(kit.input(s, 'p1', input, s.clock + 1)).toBe(s);
    expect(kit.input(s, 'p1', { ...input, index: 1 }, s.clock + 1)).toBe(s);
    expect(kit.input(s, 'p1', { ...input, questionId: s.deck[1]!.id }, s.clock + 1)).toBe(s);
    expect(kit.input(s, '__proto__', input, s.clock + 1)).toBe(s);
    expect(kit.input(s, 'spectator', input, s.clock + 1)).toBe(s);
  });
});

describe('fair freeze and reconnect', () => {
  it('freezes for exactly three seconds, spends one energy, never removes points', () => {
    const s = power(three(), 'freeze', 'p2');
    const until = s.runners.p2!.freezeUntil;
    expect(until).toBe(s.clock + 3000);
    expect(s.runners.p1!.energy).toBe(0);
    expect(s.runners.p2!.score).toBe(0);
    expect(answer(s, 'p2', true, until - 1)).toBe(s);
    expect(answer(s, 'p2', true, until).runners.p2!.score).toBe(100);
    expect(game.tvView(s).lanes.find((l) => l.id === 'p2')!.frozen).toBe(true);
  });
  it('refuses self, stranger, finished, offline and already frozen targets without spending', () => {
    const s = three();
    for (const target of ['p1', 'ghost', '__proto__']) expect(power(s, 'freeze', target)).toBe(s);
    expect(power(s, 'freeze')).toBe(s);
    const offline = kit.player(s, 'p2', false, undefined, s.clock + 1);
    expect(power(offline, 'freeze', 'p2')).toBe(offline);
    const finished = { ...s, runners: { ...s.runners, p2: { ...s.runners.p2!, answered: 6 } } };
    expect(power(finished, 'freeze', 'p2')).toBe(finished);
    const frozen = power(s, 'freeze', 'p2');
    const armed = {
      ...frozen,
      runners: { ...frozen.runners, p1: { ...frozen.runners.p1!, energy: 1 } },
    };
    expect(power(armed, 'freeze', 'p2')).toBe(armed);
  });
  it('pause shifts both clocks and freezes and never changes timer identity', () => {
    const s = power(three(), 'freeze', 'p2');
    const paused = kit.vip(s, 'pause', s.clock + 100);
    expect(answer(paused, 'p2', true, s.clock + 9999)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', s.clock + 5100);
    expect(resumed.endsAt).toBe(s.endsAt + 5000);
    expect(resumed.runners.p2!.freezeUntil).toBe(s.runners.p2!.freezeUntil + 5000);
    expect(resumed.phase.startedAt).toBe(s.phase.startedAt);
    expect(game.tvView(resumed).phaseAt).toBe(game.tvView(s).phaseAt);
    expect(kit.vip(paused, 'skip', s.clock + 5100).phase.id).toBe('podium');
  });
  it('refresh restores the exact cursor, verdict, score and energy', () => {
    const s = answer(next(answer(kit.start())));
    const dropped = kit.player(s, 'p1', false, undefined, s.clock + 10);
    expect(answer(dropped, 'p1')).toBe(dropped);
    const returned = kit.player(dropped, 'p1', true, undefined, s.clock + 100);
    expect(returned.runners.p1).toEqual(s.runners.p1);
    expect(game.controllerView(returned, 'p1').feedback).toEqual(
      game.controllerView(s, 'p1').feedback,
    );
    const left = kit.player(s, 'p1', false, 'left', s.clock + 10);
    expect(
      kit.input(
        kit.player(left, 'p1', true, undefined, s.clock + 50),
        'p1',
        { type: 'next', index: 2 },
        s.clock + 60,
      ).runners.p1,
    ).toEqual(s.runners.p1);
  });
});

describe('phase exits and results', () => {
  it('finishing alone never ends another connected player; dropping that unfinished seat does', () => {
    let s = kit.start();
    for (let i = 0; i < 6; i++) s = next(answer(s));
    expect(s.phase.id).toBe('race');
    expect(s.runners.p1!.answered).toBe(6);
    const dropped = kit.player(s, 'p2', false, undefined, s.clock + 10);
    expect(dropped.phase.id).toBe('podium');
    const paused = kit.vip(s, 'pause', s.clock + 10);
    const dropDuringPause = kit.player(paused, 'p2', false, undefined, s.clock + 20);
    expect(dropDuringPause.phase.id).toBe('race');
    expect(kit.vip(dropDuringPause, 'resume', s.clock + 30).phase.id).toBe('podium');
  });
  it('caps idle play, shows race deadline instead of beat, ignores early/stale timers and late inputs', () => {
    const s = kit.start();
    expect(game.tvView(s).deadline).toBe(91000);
    expect(kit.timer(s, s.phase.deadline! - 1)).toBe(s);
    expect(kit.reduce(s, { type: 'timer', now: s.endsAt, phaseId: 'race', startedAt: 999 })).toBe(
      s,
    );
    expect(kit.timer(s, s.endsAt).phase.id).toBe('podium');
    expect(answer(s, 'p1', true, s.endsAt).runners.p1!.score).toBe(0);
    expect(answer(s, 'p1', true, s.clock - 1)).toBe(s);
    const advanced = answer(s, 'p1', true, s.phase.deadline! + 100);
    expect(kit.timer(advanced, s.phase.deadline!)).toBe(advanced);
    expect(kit.timer(advanced, advanced.clock).clock).toBe(advanced.clock);
    expect((finishGame(game, advanced, 600) as State | null)?.phase.id).toBe('done');
    const overduePause = kit.vip(s, 'pause', s.endsAt + 100);
    expect(kit.vip(overduePause, 'resume', s.endsAt + 5100).phase.id).toBe('podium');
  });
  it.each([
    ['two distinct players', [0, 1], [2, 3], [1, 2]],
    ['eight shared winners', [0, 0, 0, 0, 0, 0, 0, 0], [3], [1, 1, 1, 1, 1, 1, 1, 1]],
    ['two shared winners and third', [1, 1, 0], [1, 3], [1, 1, 3]],
    ['three distinct players', [2, 1, 0], [1, 2, 3], [1, 2, 3]],
  ] as const)(
    '%s: reveals only occupied places, then reports all players and honest ties',
    (_scenario, correctCounts, steps, ranks) => {
      const players = testPlayers(correctCounts.length);
      const party = testKit(game, { players, settings: { questions: 6 }, t0: 1000 });
      let s = party.start();
      // Earn the fixture scores through actual answers, retaining valid runner counters.
      for (let seat = 0; seat < players.length; seat++) {
        const id = players[seat]!.id;
        for (let n = 0; n < correctCounts[seat]!; n++) {
          const q = s.deck[n]!;
          s = party.input(
            s,
            id,
            { type: 'answer', questionId: q.id, index: n, choice: q.correctIndex },
            s.clock + 10,
          );
          s = party.input(s, id, { type: 'next', index: n + 1 }, s.clock + 10);
        }
      }
      const began = s.clock + 100;
      s = party.vip(s, 'skip', began);
      for (const step of steps) {
        expect(s.phase.id).toBe('podium');
        expect(s.podiumStep).toBe(step);
        expect(s.phase.deadline).toBe(s.clock + 4500);
        expect(game.results(s)).toBeNull();
        expect(party.timer(s, s.phase.deadline! - 1)).toBe(s);
        s = party.timer(s);
      }
      expect(s.phase.id).toBe('done');
      expect(s.phase.startedAt - began).toBe(steps.length * 4500);
      const top = Math.max(...correctCounts);
      expect(game.results(s)!.winnerIds).toEqual(
        players.filter((_player, seat) => correctCounts[seat] === top).map((player) => player.id),
      );
      expect(game.results(s)!.ranking.map((r) => r.rank)).toEqual(ranks);
      expect(party.timer(s)).toBe(s);
      expect(game.controllerView(s, players[0]!.id).rank).toBe(
        1 + correctCounts.filter((count) => count > correctCounts[0]!).length,
      );
      expect(game.controllerView(s, 'spectator').rank).toBeNull();
    },
  );
  it('all disconnected exits and VIP end preserves departed scores', () => {
    let s = answer(kit.start());
    s = kit.player(s, 'p1', false, 'left', s.clock + 10);
    s = kit.player(s, 'p2', false, undefined, s.clock + 20);
    expect(s.phase.id).toBe('podium');
    s = kit.vip(s, 'end', s.clock + 10);
    expect(game.results(s)!.scores).toEqual({ p1: 100, p2: 0 });
  });
});

describe('packs and bot strengths', () => {
  it('a sharp bot never wastes its remaining race targeting a permanent leaver', () => {
    const s = { ...three(), left: ['p2'] };
    s.runners.p2 = { ...s.runners.p2!, score: 999 };
    expect(game.bot.sampleInput(s, 'p1', createRng(1), 'sharp')).toEqual({
      type: 'power',
      power: 'double',
    });
  });
  it('has 60 original bounded questions and separately authored facts with no repeats in a race', () => {
    expect(Object.keys(PACKS)).toHaveLength(3);
    for (const pack of Object.values(PACKS)) {
      expect(questionPackSchema.safeParse(pack).success).toBe(true);
      expect(pack.questions).toHaveLength(20);
      for (const q of pack.questions) expect(KNOWLEDGE[q.prompt]).toBe(q.options[q.correctIndex]);
    }
    const a = kit.start({ seed: 99 });
    expect(a.deck).toEqual(kit.start({ seed: 99 }).deck);
    expect(a.deck).not.toEqual(kit.start({ seed: 100 }).deck);
    expect(new Set(a.deck.map((q) => q.id)).size).toBe(6);
    expect(
      kit.start({ settings: { questions: 999, seconds: NaN, pack: 'ghost' } }).deck.length,
    ).toBeLessThanOrEqual(20);
  });
  it('higher strengths recall more facts; unknown seats never act', () => {
    const s = kit.start();
    const q = s.deck[0]!;
    const counts = ['easy', 'normal', 'sharp'].map((skill) => {
      let correct = 0;
      for (let seed = 1; seed <= 1000; seed++) {
        const input = game.bot.sampleInput(
          s,
          'p1',
          createRng(seed),
          skill as 'easy' | 'normal' | 'sharp',
        );
        expect(game.inputSchema.safeParse(input).success).toBe(true);
        if (input?.type === 'answer' && input.choice === q.correctIndex) correct++;
      }
      return correct;
    });
    expect(counts[0]!).toBeLessThan(counts[1]!);
    expect(counts[1]!).toBeLessThan(counts[2]!);
    expect(game.bot.sampleInput(s, '__proto__', createRng(1))).toBeNull();
  });
});
