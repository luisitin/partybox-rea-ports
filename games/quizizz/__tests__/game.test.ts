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
    {
      type: 'power',
      power,
      charge: Math.max(1, Math.floor(s.runners.p1!.correct / 3)),
      ...(target === undefined ? {} : { target }),
    },
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
  it.each(['double', 'freeze'] as const)(
    'a delayed %s retry cannot consume a later earned charge',
    (kind) => {
      let s = kit.start({ settings: { questions: 12 } });
      for (let n = 0; n < 3; n++) s = next(answer(s));
      const oldRequest = {
        type: 'power' as const,
        power: kind,
        charge: 1,
        ...(kind === 'freeze' ? { target: 'p2' } : {}),
      };
      s = kit.input(s, 'p1', oldRequest, s.clock + 10);
      expect(s.runners.p1!.energy).toBe(0);
      for (let n = 0; n < 3; n++) s = next(answer(s));
      expect(s.runners.p1).toMatchObject({ correct: 6, energy: 1, double: false });
      // Let the earlier freeze expire so its nonstacking guard cannot hide a replay bug.
      s = kit.timer(s, s.clock + 3000);
      expect(kit.input(s, 'p1', oldRequest, s.clock + 10)).toBe(s);
      expect(kit.input(s, 'p1', { ...oldRequest, charge: 3 }, s.clock + 10)).toBe(s);
      const fresh = kit.input(s, 'p1', { ...oldRequest, charge: 2 }, s.clock + 10);
      expect(fresh.runners.p1!.energy).toBe(0);
      if (kind === 'double') expect(fresh.runners.p1!.double).toBe(true);
      else expect(fresh.runners.p2!.freezeUntil).toBe(fresh.clock + 3000);
    },
  );
  it('requires a bounded integer earned charge on power inputs', () => {
    for (const charge of [undefined, 0, 7, 1.5])
      expect(game.inputSchema.safeParse({ type: 'power', power: 'double', charge }).success).toBe(
        false,
      );
    expect(game.inputSchema.safeParse({ type: 'power', power: 'double', charge: 6 }).success).toBe(
      true,
    );
  });
  it('held capped energy adopts the latest earning milestone without stacking', () => {
    let s = kit.start({ settings: { questions: 12 } });
    for (let n = 0; n < 6; n++) s = next(answer(s));
    expect(s.runners.p1).toMatchObject({ correct: 6, energy: 1 });
    expect(kit.input(s, 'p1', { type: 'power', power: 'double', charge: 1 }, s.clock + 10)).toBe(s);
    expect(power(s, 'double').runners.p1).toMatchObject({ energy: 0, double: true });
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

describe('semantic screens and stable racer identity', () => {
  it('announces only the viewer’s accepted answer and next question', () => {
    const before = kit.start();
    const mine = game.controllerView(before, 'p1');
    const otherScreen = game.controllerView(before, 'p2').screen;
    expect(mine.screen).toBe('question-0');
    const answered = answer(before);
    const verdict = game.controllerView(answered, 'p1');
    expect(verdict.screen).toBe('feedback-1');
    expect(verdict.question).toBeNull();
    expect(verdict.feedback!.correct).toBe(true);
    expect(game.controllerView(answered, 'p2').screen).toBe(otherScreen);
    const advanced = next(answered);
    const question = game.controllerView(advanced, 'p1');
    expect(question.screen).toBe('question-1');
    expect(question.question!.id).not.toBe(mine.question!.id);
    expect(question.feedback).toBeNull();
    expect(game.controllerView(advanced, 'p2').screen).toBe(otherScreen);
    expect(game.controllerView(answer(advanced), 'p1').screen).toBe('feedback-2');
  });

  it.each([false, true])(
    'keeps a question or verdict screen stable through clock, rival score and pause pushes (feedback=%s)',
    (feedback) => {
      const before = feedback ? answer(kit.start()) : kit.start();
      const expected = game.controllerView(before, 'p1');
      const beat = kit.timer(before);
      expect(beat.clock - before.phase.startedAt).toBe(500);
      const scored = answer(beat, 'p2');
      expect(scored.runners.p2!.score).toBe(100);
      const paused = kit.vip(scored, 'pause', scored.clock + 10);
      expect(game.controllerView(paused, 'p1').paused).toBe(true);
      const resumed = kit.vip(paused, 'resume', scored.clock + 1010);
      expect(resumed.endsAt).toBe(before.endsAt + 1000);
      for (const state of [beat, scored, paused, resumed]) {
        const view = game.controllerView(state, 'p1');
        expect(view.screen).toBe(expected.screen);
        expect(view.question).toEqual(expected.question);
        expect(view.feedback).toEqual(expected.feedback);
      }
    },
  );

  it('distinguishes finished players, permanent leavers and spectators while others still race', () => {
    const leftEarly = kit.player(kit.start(), 'p1', false, 'left', 1100);
    expect(game.controllerView(leftEarly, 'p1')).toMatchObject({
      screen: 'departed',
      finished: false,
      departed: true,
      question: null,
    });
    let finished = kit.start();
    for (let n = 0; n < 6; n++) {
      finished = answer(finished);
      if (n < 5) finished = next(finished);
    }
    expect(finished.phase.id).toBe('race');
    expect(game.controllerView(finished, 'p1')).toMatchObject({
      screen: 'finished',
      finished: true,
      departed: false,
    });
    expect(game.controllerView(finished, 'p2').screen).toBe('question-0');
    expect(game.controllerView(finished, 'spectator').screen).toBe('watch-race');
    const departed = kit.player(finished, 'p1', false, 'left', finished.clock + 10);
    const returned = kit.player(departed, 'p1', true, undefined, finished.clock + 20);
    expect(returned.phase.id).toBe('race');
    expect(game.controllerView(returned, 'p1')).toMatchObject({
      screen: 'departed',
      finished: true,
      departed: true,
      question: null,
    });
    expect(game.controllerView(returned, 'p2').screen).toBe('question-0');
    expect(game.controllerView(returned, 'spectator').screen).toBe('watch-race');
  });

  it('announces each occupied podium beat even though its phase instance stays the same', () => {
    let race = next(answer(next(answer(kit.start({ players: testPlayers(3) })))));
    race = next(answer(race, 'p2'), 'p2');
    let podium = kit.vip(race, 'skip', race.clock + 10);
    const phaseAt = game.controllerView(podium, 'p1').phaseAt;
    for (const step of [1, 2, 3]) {
      expect(podium.phase.id).toBe('podium');
      expect(podium.podiumStep).toBe(step);
      for (const id of ['p1', 'p2', 'spectator']) {
        const view = game.controllerView(podium, id);
        expect(view.phaseAt).toBe(phaseAt);
        expect(view.screen).toBe(`podium-${step}`);
      }
      podium = kit.timer(podium);
    }
    expect(podium.phase.id).toBe('done');
    expect(game.controllerView(podium, 'p1').screen).toBe('done');
    expect(game.controllerView(podium, 'spectator').screen).toBe('done');
  });

  it('retains all eight original color slots when final standings reverse the race order', () => {
    const players = testPlayers(8);
    let race = kit.start({ players, settings: { questions: 12 } });
    expect(game.tvView(race).lanes.map((lane) => lane.colorSlot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let seat = 0; seat < players.length; seat++) {
      const id = players[seat]!.id;
      for (let n = 0; n <= seat; n++) race = next(answer(race, id), id);
    }
    const podium = kit.vip(race, 'skip', race.clock + 10);
    const done = kit.vip(podium, 'end', race.clock + 20);
    expect(done.phase.id).toBe('done');
    for (const state of [race, podium, done]) {
      for (const view of [game.tvView(state), game.controllerView(state, 'p1')]) {
        const ranked = [...view.lanes].sort((a, b) => b.score - a.score);
        expect(ranked.map((lane) => lane.id)).toEqual([...players].reverse().map((p) => p.id));
        expect(ranked.map((lane) => lane.colorSlot)).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
      }
    }
  });
});

describe('fair freeze and reconnect', () => {
  it('attributes a freeze only to its victim using the source public name', () => {
    let s = kit.start({ players: testPlayers(3) });
    expect(Object.values(s.runners).map((runner) => runner.frozenBy)).toEqual([null, null, null]);
    for (let n = 0; n < 3; n++) s = next(answer(s));
    s = power(s, 'freeze', 'p2');
    expect(s.runners.p2!.frozenBy).toBe('p1');
    expect(game.controllerView(s, 'p2').frozenBy).toBe('Ana');
    for (const id of ['p1', 'p3', 'spectator', '__proto__'])
      expect(game.controllerView(s, id).frozenBy).toBeNull();
    const tv = game.tvView(s);
    expect(JSON.stringify(tv)).not.toMatch(/frozenBy|freezeUntil|runners|energy|feedback/);
    for (const view of [tv, game.controllerView(s, 'p1'), game.controllerView(s, 'p2')]) {
      for (const lane of view.lanes) {
        expect(lane).not.toHaveProperty('frozenBy');
        expect(lane).not.toHaveProperty('freezeUntil');
      }
    }
  });
  it('hides attribution at expiry and outside the race even with a remaining freeze', () => {
    const s = power(three(), 'freeze', 'p2');
    const until = s.runners.p2!.freezeUntil;
    const near = kit.timer(s, until - 1);
    expect(game.controllerView(near, 'p2').frozenBy).toBe('Ana');
    const expired = answer(near, 'p2', true, until);
    expect(expired.runners.p2!.score).toBe(100);
    expect(game.controllerView(expired, 'p2').frozenBy).toBeNull();
    expect(game.tvView(expired).lanes.find((lane) => lane.id === 'p2')!.frozen).toBe(false);
    const podium = kit.vip(s, 'skip', s.clock + 100);
    expect(podium.clock).toBeLessThan(until);
    expect(game.controllerView(podium, 'p2').frozenBy).toBeNull();
    const done = kit.vip(s, 'end', s.clock + 100);
    expect(game.controllerView(done, 'p2').frozenBy).toBeNull();
  });
  it('preserves attribution and its deadline when the victim and source reconnect', () => {
    const s = power(three(), 'freeze', 'p2');
    const droppedVictim = kit.player(s, 'p2', false, undefined, s.clock + 10);
    const returnedVictim = kit.player(droppedVictim, 'p2', true, undefined, s.clock + 100);
    const droppedSource = kit.player(returnedVictim, 'p1', false, undefined, s.clock + 110);
    const returnedSource = kit.player(droppedSource, 'p1', true, undefined, s.clock + 200);
    expect(returnedSource.runners.p2).toEqual(s.runners.p2);
    expect(game.controllerView(returnedSource, 'p2')).toMatchObject({
      frozenBy: 'Ana',
      freezeUntil: s.runners.p2!.freezeUntil,
    });
    expect(answer(returnedSource, 'p2', true, s.runners.p2!.freezeUntil - 1)).toBe(returnedSource);
  });
  it('refuses to replace an active freeze but replaces the source after it expires', () => {
    let s = kit.start({ players: testPlayers(3) });
    for (const id of ['p1', 'p3']) for (let n = 0; n < 3; n++) s = next(answer(s, id), id);
    s = power(s, 'freeze', 'p2');
    const request = { type: 'power' as const, power: 'freeze' as const, charge: 1, target: 'p2' };
    expect(kit.input(s, 'p3', request, s.clock + 10)).toBe(s);
    expect(s.runners.p3!.energy).toBe(1);
    expect(game.controllerView(s, 'p2').frozenBy).toBe('Ana');
    const expired = kit.timer(s, s.runners.p2!.freezeUntil);
    expect(game.controllerView(expired, 'p2').frozenBy).toBeNull();
    const refrozen = kit.input(expired, 'p3', request, expired.clock + 10);
    expect(refrozen.runners.p2).toMatchObject({
      frozenBy: 'p3',
      freezeUntil: refrozen.clock + 3000,
    });
    expect(refrozen.runners.p3!.energy).toBe(0);
    expect(game.controllerView(refrozen, 'p2').frozenBy).toBe('Cy');
    expect(game.controllerView(refrozen, 'p1').frozenBy).toBeNull();
  });
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
    expect(s.runners.p2!.frozenBy).toBeNull();
    for (const target of ['p1', 'ghost', '__proto__']) expect(power(s, 'freeze', target)).toBe(s);
    expect(power(s, 'freeze')).toBe(s);
    const offline = kit.player(s, 'p2', false, undefined, s.clock + 1);
    expect(power(offline, 'freeze', 'p2')).toBe(offline);
    const finished = { ...s, runners: { ...s.runners, p2: { ...s.runners.p2!, answered: 6 } } };
    expect(power(finished, 'freeze', 'p2')).toBe(finished);
    const frozen = power(s, 'freeze', 'p2');
    const armed: State = {
      ...frozen,
      runners: { ...frozen.runners, p1: { ...frozen.runners.p1!, energy: 1 } },
    };
    expect(power(armed, 'freeze', 'p2')).toBe(armed);
    expect(armed.runners.p2!.frozenBy).toBe('p1');
  });
  it('pause shifts both clocks and freezes and never changes timer identity', () => {
    const s = power(three(), 'freeze', 'p2');
    const paused = kit.vip(s, 'pause', s.clock + 100);
    expect(answer(paused, 'p2', true, s.clock + 9999)).toBe(paused);
    expect(game.controllerView(paused, 'p2').frozenBy).toBe('Ana');
    const resumed = kit.vip(paused, 'resume', s.clock + 5100);
    expect(resumed.endsAt).toBe(s.endsAt + 5000);
    expect(resumed.runners.p2!.freezeUntil).toBe(s.runners.p2!.freezeUntil + 5000);
    expect(resumed.runners.p2!.frozenBy).toBe('p1');
    expect(game.controllerView(resumed, 'p2').frozenBy).toBe('Ana');
    const expiry = resumed.runners.p2!.freezeUntil;
    expect(answer(resumed, 'p2', true, expiry - 1)).toBe(resumed);
    expect(game.controllerView(answer(resumed, 'p2', true, expiry), 'p2').frozenBy).toBeNull();
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
  it('a permanent leaver returns as departed, retains results and cannot resume input', () => {
    let feedback = kit.start();
    for (let n = 0; n < 3; n++) {
      feedback = answer(feedback);
      if (n < 2) feedback = next(feedback);
    }
    const feedbackReturn = kit.player(
      kit.player(feedback, 'p1', false, 'left', feedback.clock + 10),
      'p1',
      true,
      undefined,
      feedback.clock + 50,
    );
    expect(game.controllerView(feedbackReturn, 'p1').feedback).toEqual(
      feedback.runners.p1!.feedback,
    );
    expect(kit.input(feedbackReturn, 'p1', { type: 'next', index: 3 }, feedback.clock + 60)).toBe(
      feedbackReturn,
    );

    const before = next(feedback);
    const q = game.controllerView(before, 'p1').question!;
    expect(q).not.toBeNull();
    const returned = kit.player(
      kit.player(before, 'p1', false, 'left', before.clock + 10),
      'p1',
      true,
      undefined,
      before.clock + 50,
    );
    expect(returned.phase.id).toBe('race');
    const view = game.controllerView(returned, 'p1');
    expect(view).toMatchObject({
      me: { role: 'player' },
      departed: true,
      question: null,
      score: 360,
      finished: false,
    });
    expect(view.lanes.find((lane) => lane.id === 'p1')).toMatchObject({
      departed: true,
      connected: false,
      score: 360,
    });
    expect(view.players.find((player) => player.id === 'p1')!.status).toBe('waiting');
    expect(view.players.find((player) => player.id === 'p2')!.status).toBe('active');
    expect(game.controllerView(returned, 'p2').departed).toBe(false);
    expect(game.controllerView(returned, 'spectator').departed).toBe(false);
    expect(
      kit.input(
        returned,
        'p1',
        { type: 'answer', questionId: q.id, index: q.index, choice: before.deck[3]!.correctIndex },
        before.clock + 60,
      ),
    ).toBe(returned);
    expect(power(returned, 'double')).toBe(returned);
    expect(power(returned, 'freeze', 'p2')).toBe(returned);
    const done = finishGame(game, returned, 600) as State | null;
    expect(done?.phase.id).toBe('done');
    expect(game.controllerView(done!, 'p1')).toMatchObject({
      me: { role: 'player' },
      departed: true,
      score: 360,
      rank: 1,
    });
    expect(game.results(done!)!.scores.p1).toBe(360);
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
      charge: 1,
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
