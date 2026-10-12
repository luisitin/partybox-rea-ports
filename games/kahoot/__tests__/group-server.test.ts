// Direct semantic regressions for P02 on the canonical P01 reducer, with no adapter engine.
import { describe, expect, it } from 'vitest';
import { createRng, seedRng } from '@partybox/game-sdk';
import { testKit } from '@partybox/game-sdk/testing';
import { game, settingsFrom } from '../server/index';
import { questionById } from '../server/content';
import { questionPoints, scoreCurrentQuestion } from '../server/scoring';
import { recap } from '../server/recap';
import { standingsOf } from '../server/standings';
import { groupStandings, scoringMembers } from '../server/teams';
import { groupTalkMs, questionReadingMs } from '../server/pacing';
import { answerWindowOf, groupModeOf, quizModeOf, readMs, wordCount } from '../server/types';
import type { GroupMode, Input, State } from '../server/types';
import { controllerView, tvView } from '../server/views';

const kit = testKit(game, { t0: 100_000 });
const seats = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `Guest ${i + 1}`,
    avatarId: 'fox',
    connected: true,
  }));
function start(
  mode: GroupMode = 'teams',
  count = 4,
  seed = 41,
  settings: Record<string, string | number> = {},
): State {
  return game.init({
    players: seats(count),
    seed,
    now: 100_000,
    settings: {
      quizMode: mode,
      classicPack: 'general',
      questions: 5,
      answerSeconds: 30,
      teamCount: 2,
      talkSeconds: 10,
      ...settings,
    },
  });
}
function question(mode: GroupMode = 'teams', count = 4): State {
  return kit.timer(kit.timer(start(mode, count)));
}
function fixed(): State {
  const s = question();
  return {
    ...s,
    teams: [
      { id: 'team-1', name: 'Team 1', members: ['p0', 'p1'] },
      { id: 'team-2', name: 'Team 2', members: ['p2', 'p3'] },
    ],
    teamScores: { 'team-1': 0, 'team-2': 0 },
  };
}
function stamp(s: State, index: number): Extract<Input, { type: 'answer' }> {
  return {
    type: 'answer',
    questionId: s.questionIds[s.index]!,
    questionStartedAt: s.phase.startedAt,
    index,
  };
}
function answer(s: State, id: string, correct = true, ms = 100): State {
  const q = questionById(s.questionIds[s.index]!, s.contentLang)!;
  return kit.input(
    s,
    id,
    stamp(s, correct ? q.answerIndex : (q.answerIndex + 1) % 4),
    s.answerClosesAt! - answerWindowOf(s) + ms,
  );
}
function reveal(s: State): State {
  return s.phase.id === 'question' ? kit.timer(s) : s;
}

describe('group settings and fixed seeded membership', () => {
  it.each(['teams', 'tv-vote'] as const)(
    '%s maps to the canonical classic question flow',
    (mode) => {
      const s = start(mode);
      expect(groupModeOf(s)).toBe(mode);
      expect(quizModeOf(s)).toBe('classic');
      expect(s.questionIds).toHaveLength(5);
      expect(s.questionIds.every((id) => id.startsWith('general-'))).toBe(true);
      expect(s.wagers).toEqual({});
    },
  );
  it('keeps default wager and explicit classic free of group state and discussion', () => {
    for (const mode of ['wager', 'classic']) {
      const s = game.init({
        players: seats(3),
        seed: 41,
        now: 100_000,
        settings: { quizMode: mode },
      });
      expect(groupModeOf(s)).toBeUndefined();
      expect(s).not.toHaveProperty('teams');
      expect(kit.timer(s).phase.id).toBe('question');
      expect(tvView(s, 'kahoot')).not.toHaveProperty('group');
    }
  });
  it('clamps talk and team-count settings to their lobby ranges', () => {
    expect(settingsFrom({ quizMode: 'teams', talkSeconds: 1, teamCount: 99 })).toMatchObject({
      talkSeconds: 5,
      teamCount: 4,
    });
    expect(settingsFrom({ quizMode: 'teams', talkSeconds: 99, teamCount: 1 })).toMatchObject({
      talkSeconds: 20,
      teamCount: 2,
    });
  });
  it.each([2, 3, 4, 5, 6, 7, 8])(
    '%i players are assigned once and balanced without empty teams',
    (count) => {
      for (const teamCount of [2, 3, 4]) {
        const s = start('teams', count, 17, { teamCount });
        const teams = s.teams!;
        expect(teams).toHaveLength(Math.min(count, teamCount));
        expect(teams.flatMap((team) => team.members).sort()).toEqual(
          seats(count)
            .map((p) => p.id)
            .sort(),
        );
        expect(
          Math.max(...teams.map((t) => t.members.length)) -
            Math.min(...teams.map((t) => t.members.length)),
        ).toBeLessThanOrEqual(1);
        expect(start('teams', count, 17, { teamCount })).toEqual(s);
        const absent = kit.player(s, 'p0', false);
        expect(kit.player(absent, 'p0', true).teams).toEqual(teams);
      }
    },
  );
  it('the room-vote team contains every starting player', () => {
    expect(start('tv-vote', 8).teams).toEqual([
      { id: 'room', name: 'The room', members: seats(8).map((p) => p.id) },
    ]);
  });
});

describe('discussion, stamped answers and presence', () => {
  it('room discussion ignores hidden member names while the answer stage still budgets its strip', () => {
    const s: State = { ...start('tv-vote', 8), index: 0, questionIds: ['sports-09'] };
    const longNames: State = {
      ...s,
      players: Object.fromEntries(
        Object.entries(s.players).map(([id, player]) => [
          id,
          { ...player, name: 'One two three four five six seven eight' },
        ]),
      ),
    };
    expect(groupTalkMs(longNames)).toBe(groupTalkMs(s));
    expect(questionReadingMs(longNames)).toBeGreaterThan(questionReadingMs(s));
    expect(groupTalkMs(longNames)).toBeLessThan(questionReadingMs(longNames));
    const q = questionById('sports-09')!;
    // This is the complete TV talk screen: question/options/marks, clock label,
    // answer count, discussion cue and footer. No other player's name is visible.
    const visible =
      wordCount(q.question) +
      q.choices.reduce((n, text) => n + wordCount(text), 0) +
      4 +
      wordCount(
        '20 Room talk 0 of 8 votes Discuss the room answer · then everyone votes Question 1 of 5 Room vote',
      );
    expect(groupTalkMs(s)).toBeGreaterThanOrEqual(readMs(visible));
  });
  it('team discussion budgets the largest own roster without summing other teams', () => {
    const s: State = {
      ...start('teams', 8),
      index: 0,
      questionIds: ['sports-09'],
      teams: [
        { id: 'team-1', name: 'Team 1', members: ['p0', 'p1', 'p2', 'p3'] },
        { id: 'team-2', name: 'Team 2', members: ['p4', 'p5', 'p6', 'p7'] },
      ],
    };
    const names = (all: boolean): State => ({
      ...s,
      players: Object.fromEntries(
        Object.entries(s.players).map(([id, player]) => [
          id,
          {
            ...player,
            name:
              all || ['p0', 'p1', 'p2', 'p3'].includes(id)
                ? 'One two three four five six seven eight'
                : player.name,
          },
        ]),
      ),
    });
    const oneLongTeam = names(false);
    const everyLongTeam = names(true);
    expect(groupTalkMs(oneLongTeam)).toBeGreaterThan(groupTalkMs(s));
    expect(groupTalkMs(everyLongTeam)).toBe(groupTalkMs(oneLongTeam));
    const visibleOwnPhone = wordCount(
      'Talk with your team 20 Team 1 One two three four five six seven eight One two three four five six seven eight One two three four five six seven eight One two three four five six seven eight Discuss now. Everyone answers when the clock ends. Answers open after discussion',
    );
    expect(groupTalkMs(oneLongTeam)).toBeGreaterThanOrEqual(readMs(visibleOwnPhone));
    const smallerTeams: State = {
      ...everyLongTeam,
      teams: Array.from({ length: 4 }, (_, index) => ({
        id: `team-${index + 1}`,
        name: `Team ${index + 1}`,
        members: [`p${index * 2}`, `p${index * 2 + 1}`],
      })),
    };
    expect(groupTalkMs(smallerTeams)).toBeLessThan(groupTalkMs(everyLongTeam));
  });
  it.each(['teams', 'tv-vote'] as const)(
    '%s VIP end discards an unfinished accepted answer and retains every starter',
    (mode) => {
      const first = question(mode);
      const partial = answer(first, 'p0', true, 100);
      expect(partial.phase.id).toBe('question');
      expect(partial.picks.p0).toBeDefined();
      const ended = kit.vip(partial, 'end', partial.phase.startedAt + 200);
      expect(ended.phase.id).toBe('done');
      expect(ended.scores).toEqual(first.scores);
      expect(ended.teamScores).toEqual(first.teamScores);
      expect(Object.values(ended.scores).every((score) => score === 0)).toBe(true);
      expect(
        game
          .results(ended)
          ?.ranking.map((row) => row.playerId)
          .sort(),
      ).toEqual(
        seats(4)
          .map((seat) => seat.id)
          .sort(),
      );
      // A later unfinished question must preserve points already banked in the first reveal.
      const banked = reveal(partial);
      const next = kit.timer(kit.timer(banked));
      const pending = answer(next, 'p0', true, 100);
      const stopped = kit.vip(pending, 'end', pending.phase.startedAt + 200);
      expect(stopped.scores).toEqual(banked.scores);
      expect(stopped.teamScores).toEqual(banked.teamScores);
      expect(game.results(stopped)?.ranking).toHaveLength(4);
    },
  );
  it('rejects a wrong question ID, a duplicate first choice and a departed-seat packet', () => {
    const s = question();
    const good = stamp(s, 0);
    expect(
      kit.input(s, 'p0', { ...good, questionId: 'wrong-question' }, s.phase.startedAt + 100),
    ).toBe(s);
    const accepted = kit.input(s, 'p0', good, s.phase.startedAt + 100);
    expect(kit.input(accepted, 'p0', { ...good, index: 1 }, s.phase.startedAt + 200)).toBe(
      accepted,
    );
    expect(accepted.picks.p0?.index).toBe(0);
    const left = kit.player(s, 'p1', false, 'left', s.phase.startedAt + 100);
    const reconnected = kit.player(left, 'p1', true, undefined, s.phase.startedAt + 200);
    expect(kit.input(reconnected, 'p1', good, s.phase.startedAt + 300)).toBe(reconnected);
    expect(reconnected.picks).not.toHaveProperty('p1');
  });
  it('talk reveals the question without accepting picks, stamped answers or bots', () => {
    const talk = kit.timer(start());
    expect(talk.phase.id).toBe('talk');
    expect(talk.index).toBe(0);
    expect(talk.phase.deadline! - talk.phase.startedAt).toBeGreaterThanOrEqual(10_000);
    expect(tvView(talk, 'kahoot').question).not.toBeNull();
    expect(controllerView(talk, 'kahoot', 'p0').question).not.toBeNull();
    expect(tvView(talk, 'kahoot')).not.toHaveProperty('correctIndex');
    expect(controllerView(talk, 'kahoot', 'p0')).not.toHaveProperty('answerStamp');
    expect(kit.input(talk, 'p0', stamp(talk, 0))).toBe(talk);
    expect(kit.input(talk, 'p0', { type: 'pick', index: 0 })).toBe(talk);
    expect(game.bot.sampleInput(talk, 'p0', createRng(1), 'sharp')).toBeNull();
  });
  it('opens a fresh answer clock for the discussed question and ignores old discussion stamps', () => {
    const talk = kit.timer(start());
    const s = kit.timer(talk);
    expect(s.phase.id).toBe('question');
    expect(s.index).toBe(talk.index);
    expect(s.phase.startedAt).toBe(talk.phase.deadline);
    expect(answerWindowOf(s)).toBeGreaterThanOrEqual(30_000);
    expect(kit.input(s, 'p0', stamp(talk, 0), s.phase.startedAt + 100)).toBe(s);
    expect(kit.input(s, 'p0', { type: 'pick', index: 0 })).toBe(s);
    expect(answer(s, 'p0').picks.p0?.elapsedMs).toBe(100);
  });
  it('ignores early/stale discussion timers and a paused discussion stays frozen', () => {
    const talk = kit.timer(start());
    expect(kit.timer(talk, talk.phase.deadline! - 1)).toBe(talk);
    expect(
      game.reduce(talk, {
        type: 'timer',
        phaseId: 'talk',
        startedAt: talk.phase.startedAt - 1,
        now: talk.phase.deadline!,
      }),
    ).toBe(talk);
    const paused = kit.vip(talk, 'pause', talk.phase.startedAt + 100);
    expect(kit.timer(paused, talk.phase.deadline! + 5000)).toBe(paused);
    const back = kit.vip(paused, 'resume', paused.phase.paused!.at + 4000);
    expect(back.phase.deadline).toBe(talk.phase.deadline! + 4000);
    expect(kit.timer(back).index).toBe(talk.index);
  });
  it('VIP skip moves talk into the same question; ending talk does not score an unasked round', () => {
    const talk = kit.timer(start());
    expect(kit.vip(talk, 'skip').index).toBe(0);
    expect(kit.vip(talk, 'skip').phase.id).toBe('question');
    const done = kit.vip(talk, 'end');
    expect(done.phase.id).toBe('done');
    expect(done.teamScores).toEqual({ 'team-1': 0, 'team-2': 0 });
  });
  it('the next discussion clears old decisions and picks without skipping a question', () => {
    const first = reveal(answer(question('tv-vote'), 'p0'));
    const talk = kit.timer(first);
    expect(talk.phase.id).toBe('talk');
    expect(talk.index).toBe(1);
    expect(talk.picks).toEqual({});
    expect(talk).not.toHaveProperty('roomDecision');
    expect(tvView(talk, 'kahoot').group).not.toHaveProperty('decision');
    expect(kit.timer(talk).index).toBe(1);
  });
  it('answer pause is excluded from speed and unanswered reconnect restores the original window', () => {
    let s = question();
    const end = s.answerClosesAt!;
    s = answer(s, 'p0');
    const paused = kit.vip(s, 'pause', s.phase.startedAt + 200);
    const back = kit.vip(paused, 'resume', paused.phase.paused!.at + 4000);
    expect(back.answerClosesAt).toBe(end + 4000);
    expect(answer(back, 'p1', true, 300).picks.p1?.elapsedMs).toBe(300);
    let held = question();
    held = kit.player(held, 'p3', false);
    for (const id of ['p0', 'p1', 'p2']) held = answer(held, id);
    expect(held.phase.deadline).toBe(held.questionReadableUntil);
    const restored = kit.player(held, 'p3', true, undefined, held.phase.startedAt + 200);
    expect(restored.phase.deadline).toBe(restored.answerClosesAt);
  });
});

describe('team averaging without departure exploits', () => {
  it('averages correct, wrong and missing eligible members instead of summing team size', () => {
    const s = fixed();
    const judged = reveal(answer(answer(answer(s, 'p0'), 'p1', false), 'p2'));
    const points = questionPoints(100, answerWindowOf(s) / 1000, 1);
    expect(judged.teamGains).toEqual({
      'team-1': Math.round(points / 2),
      'team-2': Math.round(points / 2),
    });
    expect(judged.scores.p0).toBe(judged.teamScores!['team-1']);
    expect(judged.scores.p1).toBe(judged.scores.p0);
  });
  it('excludes an unanswered offline or permanently departed teammate from the denominator', () => {
    for (const reason of [undefined, 'left'] as const) {
      const s = fixed();
      const absent = kit.player(s, 'p1', false, reason);
      const judged = reveal(answer(absent, 'p0'));
      expect(scoringMembers(judged, judged.teams![0]!)).toEqual(['p0']);
      expect(judged.teamGains!['team-1']).toBe(questionPoints(100, answerWindowOf(s) / 1000, 1));
      expect(judged.teams).toEqual(s.teams);
    }
  });
  it('retains a locked answer from a leaver and cannot inflate a wrong answer away by disconnecting', () => {
    let s = answer(fixed(), 'p0', false);
    s = kit.player(s, 'p0', false, 'left', s.phase.startedAt + 200);
    s = answer(s, 'p1', true, 300);
    const judged = reveal(s);
    expect(scoringMembers(judged, judged.teams![0]!)).toEqual(['p0', 'p1']);
    expect(judged.teamGains!['team-1']).toBe(
      Math.round(questionPoints(300, answerWindowOf(s) / 1000, 1) / 2),
    );
    expect(kit.player(judged, 'p0', true).teams).toEqual(s.teams);
  });
  it('an entirely absent team gains zero while keeping historical points', () => {
    let s: State = { ...fixed(), teamScores: { 'team-1': 200, 'team-2': 0 } };
    s = kit.player(kit.player(s, 'p0', false), 'p1', false);
    const judged = reveal(s);
    expect(judged.teamGains!['team-1']).toBe(0);
    expect(judged.teamScores!['team-1']).toBe(200);
  });
  it('banks a round only once when a repeated timer arrives', () => {
    const s = question();
    const event = {
      type: 'timer' as const,
      phaseId: s.phase.id,
      startedAt: s.phase.startedAt,
      now: s.phase.deadline!,
    };
    const judged = game.reduce(s, event);
    expect(game.reduce(judged, event)).toBe(judged);
    expect(judged.phase.id).toBe('reveal');
  });
});

describe('shared plurality, speed and bounded room streak', () => {
  it('does not turn collective speed and streaks into personal awards for an abstaining guest', () => {
    let s = question('tv-vote', 3);
    for (let round = 0; round < 2; round++) {
      s = reveal(answer(answer(s, 'p1', true, 100), 'p2', true, 200));
      expect(s.picks).not.toHaveProperty('p0');
      expect(s.roomStreak).toBe(round + 1);
      if (round === 0) s = kit.timer(kit.timer(s));
    }
    const ended = kit.vip(s, 'end');
    const result = game.results(ended)!;
    expect(result.scores.p0).toBeGreaterThan(0);
    expect(result.scores.p0).toBe(result.scores.p1);
    expect(result.awards).toEqual([]);
    expect(result.outcome).toMatchObject({ kind: 'teams', winner: 'room' });
  });
  it('scores the plurality decision even if a minority voted correctly', () => {
    let s = question('tv-vote', 3);
    s = answer(answer(answer(s, 'p0', false), 'p1', false, 200), 'p2', true, 300);
    const judged = reveal(s);
    const q = questionById(s.questionIds[s.index]!)!;
    expect(judged.roomDecision).toBe((q.answerIndex + 1) % 4);
    expect(judged.teamGains?.room).toBe(0);
    expect(Object.values(judged.streaks)).toEqual([0, 0, 0]);
    expect(controllerView(judged, 'kahoot', 'p2').outcome?.correct).toBe(false);
  });
  it('uses the mean time of every vote and credits the same room gain to everyone', () => {
    let s = question('tv-vote', 3);
    s = answer(answer(answer(s, 'p0', true, 100), 'p1', true, 200), 'p2', false, 900);
    const judged = reveal(s);
    const expected = questionPoints(400, answerWindowOf(s) / 1000, 1);
    expect(judged.roomElapsedMs).toBe(400);
    expect(judged.teamGains?.room).toBe(expected);
    expect(Object.values(judged.scores)).toEqual([expected, expected, expected]);
    expect(controllerView(judged, 'kahoot', 'p2').outcome).toMatchObject({
      correct: true,
      delta: expected,
      base: expected,
      bonus: 0,
    });
  });
  it('breaks plurality ties reproducibly with state RNG without always choosing the lower option', () => {
    const outcomes = new Set<number>();
    const initial = question('tv-vote', 2);
    const picked = answer(answer(initial, 'p0', true), 'p1', false, 200);
    for (let seed = 1; seed <= 20; seed++) {
      const s = { ...picked, rng: seedRng(seed) };
      expect(scoreCurrentQuestion(s)).toEqual(scoreCurrentQuestion(structuredClone(s)));
      const judged = scoreCurrentQuestion(s);
      outcomes.add(judged.roomDecision!);
      expect(judged.rng).not.toEqual(s.rng);
    }
    expect(outcomes.size).toBe(2);
  });
  it('no votes means no decision, no points and a broken shared streak', () => {
    const judged = reveal({ ...question('tv-vote'), roomStreak: 4 });
    expect(judged).not.toHaveProperty('roomDecision');
    expect(judged.teamGains?.room).toBe(0);
    expect(judged.roomStreak).toBe(0);
    expect(controllerView(judged, 'kahoot', 'p0').outcome).toMatchObject({
      correct: false,
      answered: false,
      delta: 0,
    });
  });
  it('shares a correct streak while keeping the canonical three-hundred-point bonus cap', () => {
    const s = { ...question('tv-vote'), roomStreak: 9 };
    const judged = reveal(answer(s, 'p0'));
    expect(judged.roomStreak).toBe(10);
    expect(Object.values(judged.streaks).every((n) => n === 10)).toBe(true);
    expect(controllerView(judged, 'kahoot', 'p0').outcome?.bonus).toBe(300);
  });
});

describe('group projection, podium privacy and results', () => {
  it('records collective room decisions and team means separately from personal choices', () => {
    let room = question('tv-vote', 3);
    room = reveal(answer(answer(answer(room, 'p0', true, 100), 'p1', true, 200), 'p2', false, 900));
    const recorded = recap(room, {
      players: Object.values(room.players),
      results: null,
      history: [{ phase: 'reveal', at: room.phase.startedAt, state: room }],
    })!.markdown;
    expect(recorded).toContain('Quiz mode: Room vote');
    expect(recorded).toContain('Room decision:');
    expect(recorded).toContain('shared streak 1 · mean vote time 0.4 s');
    expect(recorded).toContain(`The room: +${room.teamGains!.room} shared points`);
    expect(recorded).toContain(`${room.lastDelta.p2} room points`);
    let teams = fixed();
    teams = reveal(answer(answer(teams, 'p0'), 'p1', false));
    const teamRecord = recap(teams, {
      players: Object.values(teams.players),
      results: null,
      history: [{ phase: 'reveal', at: teams.phase.startedAt, state: teams }],
    })!.markdown;
    expect(teamRecord).toContain('Quiz mode: Teams');
    expect(teamRecord).toContain(`Team 1: +${teams.teamGains!['team-1']} averaged points`);
    expect(teamRecord).toContain('personal points');
    expect(teamRecord).not.toContain('Room decision:');
  });
  it('omits the decision and other players picks before reveal, including spectator stage', () => {
    const s = answer(question('tv-vote'), 'p0');
    const tv = tvView(s, 'kahoot');
    const phone = controllerView(s, 'kahoot', 'p1');
    expect(tv.group).not.toHaveProperty('decision');
    expect(tv).not.toHaveProperty('correctIndex');
    expect(tv).not.toHaveProperty('picks');
    expect(phone.myPickIndex).toBeNull();
    expect(phone.stage).toBeNull();
    const guest = controllerView(s, 'kahoot', 'spectator');
    expect(guest.stage?.group).not.toHaveProperty('decision');
    expect(guest.group).not.toHaveProperty('myTeamId');
    expect(answer(s, '__proto__')).toBe(s);
  });
  it('withholds future team scores and podium tiers from both envelopes and personal totals', () => {
    const s = fixed();
    const final: State = {
      ...s,
      phase: { id: 'reveal', startedAt: 100_000, deadline: 200_000 },
      index: s.questionIds.length - 1,
      teamScores: { 'team-1': 2000, 'team-2': 1000 },
      teamGains: { 'team-1': 700, 'team-2': 500 },
      scores: { p0: 2000, p1: 2000, p2: 1000, p3: 1000 },
    };
    expect(tvView(final, 'kahoot').group?.teams).toEqual([]);
    expect(tvView(final, 'kahoot').players.every((p) => !Object.hasOwn(p, 'score'))).toBe(true);
    expect(controllerView(final, 'kahoot', 'p0').myScore).toBe(1300);
    const second = kit.timer(final);
    expect(second.phase.id).toBe('podium');
    expect(second.podiumRank).toBe(2);
    const v = tvView(second, 'kahoot');
    expect(v.group?.teams.map((t) => t.id)).toEqual(['team-2']);
    expect(v.podium?.entries.map((t) => t.playerId)).toEqual(['team-2']);
    expect(controllerView(second, 'kahoot', 'p0')).not.toHaveProperty('myRank');
    expect(controllerView(second, 'kahoot', 'p0').myScore).toBe(1300);
    expect(controllerView(second, 'kahoot', 'p2')).toMatchObject({ myRank: 2, myScore: 1000 });
    expect(v.players.every((p) => !Object.hasOwn(p, 'score'))).toBe(true);
    expect(game.results(second)).toBeNull();
  });
  it('ranks teams rather than member count and returns canonical team outcomes', () => {
    const s = fixed();
    const done: State = {
      ...s,
      phase: { id: 'done', startedAt: 100_000, deadline: null },
      teamScores: { 'team-1': 500, 'team-2': 200 },
      scores: { p0: 500, p1: 500, p2: 200, p3: 200 },
    };
    expect(standingsOf(done).map((row) => row.rank)).toEqual([1, 2]);
    expect(groupStandings(done).map((team) => team.rank)).toEqual([1, 2]);
    expect(game.results(done)?.ranking.map((row) => row.rank)).toEqual([1, 1, 2, 2]);
    expect(game.results(done)?.winnerIds).toEqual(['p0', 'p1']);
    expect(game.results(done)?.outcome).toMatchObject({ kind: 'teams', winner: 'team-1' });
    for (const id of ['p0', 'p1', 'p2', 'p3', 'spectator']) {
      const phone = controllerView(done, 'kahoot', id);
      expect(phone.standings?.map((team) => team.playerId)).toEqual(['team-1', 'team-2']);
      expect(phone.standings?.map((team) => team.rank)).toEqual([1, 2]);
    }
    const tied = {
      ...done,
      teamScores: { 'team-1': 500, 'team-2': 500 },
      scores: { p0: 500, p1: 500, p2: 500, p3: 500 },
    };
    expect(game.results(tied)?.outcome).toMatchObject({ kind: 'teams', winner: null });
    expect(game.results(tied)?.winnerIds).toHaveLength(4);
  });
  it('group bots use canonical stamped answers and a remote/departed phone retains the public stage', () => {
    let s = question();
    const input = game.bot.sampleInput(s, 'p0', createRng(2), 'sharp');
    expect(input).toMatchObject({
      type: 'answer',
      questionId: s.questionIds[0],
      questionStartedAt: s.phase.startedAt,
    });
    expect(game.inputSchema.safeParse(input).success).toBe(true);
    s = kit.player(s, 'p0', false, 'left');
    const view = controllerView(kit.player(s, 'p0', true), 'kahoot', 'p0');
    expect(view.participating).toBe(false);
    expect(view.stage?.group?.mode).toBe('teams');
  });
});
