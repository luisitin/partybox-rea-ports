// Mode rules at real reducer boundaries: discussion, immutable taps, shared credit and privacy.
import { describe, expect, it } from 'vitest';
import { createRng, readingMs, seedRng, wordCount } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { botInput } from '../server/bot';
import { currentQuestion, makeDeck } from '../server/content';
import { enterReveal } from '../server/phases/reveal';
import { enterTalk } from '../server/phases/talk';
import { standings } from '../server/scoring';
import type { QuizMode, State } from '../server/types';

const kit = testKit(game, { players: testPlayers(4), settings: { rounds: 5, seconds: 20 } });
const start = (mode: QuizMode, count = 4, teamCount = 2, seed = 1): State =>
  kit.start({ players: testPlayers(count), settings: { mode, teamCount }, seed });
const question = (mode: QuizMode = 'teams', count = 4, teamCount = 2): State =>
  kit.timer(start(mode, count, teamCount));
const tap = (s: State, id: string, choice = currentQuestion(s).correct, elapsed = 0): State =>
  kit.input(s, id, { type: 'answer', round: s.round, choice }, s.openedAt + elapsed);
const wrong = (s: State): number => (currentQuestion(s).correct + 1) % 4;
const nextRound = (s: State): State => kit.timer(kit.timer(kit.timer(s)));

describe('fixed teams and discussion', () => {
  it('balances every supported roster without duplicates, clamps groups and repeats seeded seats', () => {
    for (let count = 2; count <= 8; count++) {
      for (let seed = 1; seed <= 12; seed++) {
        const s = start('teams', count, 4, seed);
        const lengths = s.teams.map((team) => team.members.length);
        expect(s.teams).toHaveLength(Math.min(count, 4));
        expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
        expect(s.teams.flatMap((team) => team.members).sort()).toEqual(
          testPlayers(count).map((p) => p.id),
        );
        expect(start('teams', count, 4, seed).teams).toEqual(s.teams);
      }
    }
    const arrangements = new Set(
      Array.from({ length: 12 }, (_, i) => JSON.stringify(start('teams', 8, 2, i + 1).teams)),
    );
    expect(arrangements.size).toBeGreaterThan(1);
  });
  it('keeps team membership through temporary drops, returns and permanent departures', () => {
    let s = start('teams', 8, 3);
    const groups = s.teams;
    s = kit.player(s, 'p1', false);
    s = kit.player(s, 'p1', true);
    s = kit.player(s, 'p2', false, 'left');
    expect(s.teams).toBe(groups);
    expect(s.teams.flatMap((team) => team.members)).toContain('p2');
  });
  it.each(['teams', 'tv-vote'] as const)(
    'rejects all taps and bots during %s discussion and excludes talk from speed',
    (mode) => {
      const talk = start(mode);
      expect(talk.phase.id).toBe('talk');
      expect(tap(talk, 'p1')).toBe(talk);
      expect(botInput(talk, 'p1', createRng(1))).toBeNull();
      expect(game.controllerView(talk, 'p1').question).toEqual(game.tvView(talk).question);
      expect(game.controllerView(talk, 'p1').verdict).toBeNull();
      const s = kit.timer(talk);
      expect(s.openedAt).toBe(talk.phase.deadline);
      const answered = tap(s, 'p1', currentQuestion(s).correct, 1000);
      expect(answered.answers.p1!.elapsed).toBe(1000);
      expect(kit.timer(answered).verdicts.p1!.base).toBe(975);
    },
  );
  it('reserves reading time for long choices and honors the configured minimum', () => {
    const s = start('teams');
    const q = currentQuestion(s);
    const long = {
      ...q,
      prompt: 'Read this question carefully before discussing your answer with your team',
      options: q.options.map(
        (option) => `${option} with several extra descriptive words for discussion`,
      ) as typeof q.options,
    };
    const state = { ...s, deck: [long, ...s.deck.slice(1)] };
    const talk = enterTalk(state, 1000, 1);
    const roster = state.teams
      .flatMap((team) => [team.name, ...team.members.map((id) => state.players[id]!.name)])
      .join(' ');
    const words = wordCount([long.prompt, ...long.options].join(' ')) + 22 + wordCount(roster);
    expect(talk.phase.deadline! - talk.phase.startedAt).toBe(
      Math.max(5000, readingMs(words, { ui: true })),
    );
    const twenty = enterTalk(
      { ...state, settings: { ...state.settings, talkSeconds: 20 } },
      1000,
      1,
    );
    expect(twenty.phase.deadline! - twenty.phase.startedAt).toBeGreaterThanOrEqual(20_000);
    expect(kit.timer(talk, talk.phase.deadline! - 1)).toBe(talk);
  });
  it('pauses discussion and answer speed, skips to the proper phase and ends without unfinished credit', () => {
    let s = start('teams');
    const deadline = s.phase.deadline!;
    s = kit.vip(s, 'pause', s.phase.startedAt + 1000);
    expect(kit.timer(s)).toBe(s);
    s = kit.vip(s, 'resume', s.phase.startedAt + 6000);
    expect(s.phase.deadline).toBe(deadline + 5000);
    s = kit.vip(s, 'skip', s.phase.startedAt + 7000);
    expect(s.phase.id).toBe('question');
    const opened = s.openedAt;
    s = kit.vip(s, 'pause', opened + 1000);
    s = kit.vip(s, 'resume', opened + 6000);
    expect(tap(s, 'p1', currentQuestion(s).correct, 2000).answers.p1!.elapsed).toBe(2000);
    const partial = tap(s, 'p1', currentQuestion(s).correct, 2000);
    const done = kit.vip(partial, 'end', opened + 8000);
    expect(done.phase.id).toBe('done');
    expect(Object.values(game.results(done)!.scores)).toEqual([0, 0, 0, 0]);
    expect(kit.vip(done, 'skip')).toBe(done);
  });
});

describe('mean team credit', () => {
  it('credits the rounded mean once, shares totals and preserves personal outcomes and streaks', () => {
    let s = question();
    const [a, b] = s.teams[0]!.members;
    s = tap(s, a!);
    s = tap(s, b!, wrong(s));
    s = kit.timer(s);
    expect(s.teamGains[s.teams[0]!.id]).toBe(500);
    expect(s.scores[a!]).toBe(500);
    expect(s.scores[b!]).toBe(500);
    expect(s.verdicts[a!]).toMatchObject({ points: 1000, outcome: 'correct', streak: 1 });
    expect(s.verdicts[b!]).toMatchObject({ points: 0, outcome: 'wrong', streak: 0 });
    expect(game.controllerView(s, a!).team).toMatchObject({ gained: 500, score: 500, rank: 1 });
    expect(enterReveal(s, s.phase.startedAt + 10)).toBe(s);
    const total = s.scores;
    expect(kit.timer(s).scores).toBe(total);
  });
  it('uses the mean rather than a sum for unequal balanced team sizes', () => {
    let s = question('teams', 5);
    for (const team of s.teams) {
      for (const [index, id] of team.members.entries())
        s = tap(s, id, index === 0 ? currentQuestion(s).correct : wrong(s));
    }
    expect(s.phase.id).toBe('reveal');
    for (const team of s.teams)
      expect(s.teamGains[team.id]).toBe(team.members.length === 3 ? 333 : 500);
  });
  it('averages personal streak bonuses and restores a returning unanswered seat to eligibility', () => {
    let s = question();
    const [a, b] = s.teams[0]!.members;
    s = { ...s, streaks: { ...s.streaks, [a!]: 5, [b!]: 1 } };
    s = kit.player(s, b!, false);
    s = kit.player(s, b!, true);
    s = tap(s, a!);
    s = tap(s, b!);
    s = kit.timer(s);
    expect(s.teamGains[s.teams[0]!.id]).toBe(1300);
    expect(s.verdicts[a!]?.bonus).toBe(500);
    expect(s.verdicts[b!]?.bonus).toBe(100);
  });
  it.each([undefined, 'left'] as const)(
    'excludes an unanswered offline seat (%s) but not a connected timeout',
    (gone) => {
      let s = question();
      const [a, b] = s.teams[0]!.members;
      s = kit.player(s, b!, false, gone);
      s = tap(s, a!);
      expect(kit.timer(s).teamGains[s.teams[0]!.id]).toBe(1000);
      const connected = tap(question(), a!);
      expect(kit.timer(connected).teamGains[s.teams[0]!.id]).toBe(500);
    },
  );
  it('retains an already submitted departed member in both the mean and final results', () => {
    let s = question();
    const [a, b] = s.teams[0]!.members;
    s = tap(s, a!);
    s = kit.player(s, a!, false, 'left');
    s = tap(s, b!, wrong(s));
    s = kit.timer(s);
    expect(s.teamGains[s.teams[0]!.id]).toBe(500);
    const result = game.results(kit.vip(s, 'end'))!;
    expect(result.scores[a!]).toBe(500);
    expect(result.ranking.find((row) => row.playerId === a!)?.rank).toBe(1);
    expect(result.winnerIds).toContain(a!);
  });
  it('ranks group rows and every member by groups rather than duplicated player totals', () => {
    let s = question('teams', 8, 4);
    for (const [index, team] of s.teams.entries()) {
      for (const id of team.members) s = tap(s, id, currentQuestion(s).correct, index * 2000);
    }
    expect(standings(s).map((row) => row.rank)).toEqual([1, 2, 3, 4]);
    const result = game.results(kit.vip(s, 'end'))!;
    for (const [index, team] of s.teams.entries()) {
      for (const id of team.members)
        expect(result.ranking.find((row) => row.playerId === id)?.rank).toBe(index + 1);
    }
    expect(new Set(result.winnerIds)).toEqual(new Set(s.teams[0]!.members));
    expect(result.outcome).toMatchObject({ kind: 'teams', winner: s.teams[0]!.id });
  });
  it('never waits for an empty room, including the next discussion', () => {
    let s = start('teams');
    for (const id of Object.keys(s.players)) s = kit.player(s, id, false, 'left');
    expect(s.phase.id).toBe('reveal');
    expect(Object.values(s.teamGains)).toEqual([0, 0]);
    s = kit.timer(kit.timer(s));
    expect(s.phase.id).toBe('reveal');
    expect(s.round).toBe(2);
    expect(Object.values(s.scores)).toEqual([0, 0, 0, 0]);
  });
});

describe('one room vote', () => {
  it('chooses the plurality once and scores mean accepted elapsed with a shared streak', () => {
    let s = question('tv-vote');
    const correct = currentQuestion(s).correct;
    for (const [index, id] of Object.keys(s.players).entries())
      s = tap(s, id, index < 3 ? correct : wrong(s), [0, 2000, 4000, 6000][index]!);
    expect(s.teams).toEqual([{ id: 'room', name: 'The room', members: ['p1', 'p2', 'p3', 'p4'] }]);
    expect(s.decision).toBe(correct);
    expect(s.teamGains.room).toBe(925);
    expect(Object.values(s.scores)).toEqual([925, 925, 925, 925]);
    expect(Object.values(s.verdicts).every((v) => v.base === 925 && v.streak === 1)).toBe(true);
    s = nextRound(s);
    for (const id of Object.keys(s.players)) s = tap(s, id);
    expect(s.teamGains.room).toBe(1100);
    expect(s.roomStreak).toBe(2);
  });
  it('breaks a tied plurality with only seeded tied choices and unchanged first votes', () => {
    const tied = (seed: number): State => {
      let s = kit.timer(start('tv-vote', 4, 2, seed));
      s = tap(s, 'p1', 0);
      expect(tap(s, 'p1', 3)).toBe(s);
      expect(kit.input(s, 'p2', { type: 'answer', round: 2, choice: 3 })).toBe(s);
      s = tap(s, 'p2', 0);
      s = tap(s, 'p3', 2);
      return tap(s, 'p4', 2);
    };
    const decisions = new Set<number | null>();
    for (let seed = 1; seed <= 30; seed++) {
      const s = tied(seed);
      expect([0, 2]).toContain(s.decision);
      expect(tied(seed).decision).toBe(s.decision);
      expect(tied(seed).rng).toEqual(s.rng);
      expect(s.answers.p1!.choice).toBe(0);
      expect(enterReveal(s, s.phase.startedAt + 10)).toBe(s);
      decisions.add(s.decision);
    }
    expect(decisions).toEqual(new Set([0, 2]));
  });
  it('keeps accepted departed votes, ignores absent votes, and gives no-vote timeouts zero', () => {
    let s = question('tv-vote');
    s = tap(s, 'p1', currentQuestion(s).correct, 2000);
    s = kit.player(s, 'p1', false, 'left');
    s = kit.timer(s);
    expect(s.teamGains.room).toBe(950);
    expect(s.answers.p1).toBeDefined();
    const empty = kit.timer(question('tv-vote'));
    expect(empty.decision).toBeNull();
    expect(empty.teamGains.room).toBe(0);
    expect(
      Object.values(empty.verdicts).every((v) => v.outcome === 'timeout' && v.streak === 0),
    ).toBe(true);
  });
  it('resets a room streak on no votes and clears the previous decision before a new discussion', () => {
    let s = question('tv-vote');
    for (const id of Object.keys(s.players)) s = tap(s, id);
    const talk = kit.timer(kit.timer(s));
    expect(talk.phase.id).toBe('talk');
    expect(talk.answers).toEqual({});
    expect(game.controllerView(talk, 'p1')).toMatchObject({
      decision: null,
      verdict: null,
      submitted: false,
    });
    expect(game.controllerView(talk, 'p1').team?.gained).toBe(0);
    s = kit.timer(kit.timer(talk));
    expect(s.roomStreak).toBe(0);
    expect(s.teamGains.room).toBe(0);
    s = nextRound(s);
    for (const id of Object.keys(s.players)) s = tap(s, id);
    expect(s.teamGains.room).toBe(1000);
  });
});

describe('mode privacy and solo compatibility', () => {
  it.each(['teams', 'tv-vote'] as const)(
    'keeps %s choices, elapsed and the answer key private until reveal',
    (mode) => {
      for (const phase of ['talk', 'question'] as const) {
        const base = phase === 'talk' ? start(mode) : question(mode);
        const s = phase === 'talk' ? base : tap(base, 'p1', 0);
        const changed: State = {
          ...s,
          deck: s.deck.map((q) => ({
            ...q,
            correct: (q.correct + 1) % 4,
            explanation: 'SECRET ONLY',
          })),
          answers: phase === 'talk' ? {} : { ...s.answers, p1: { choice: 3, elapsed: 9999 } },
        };
        expect(game.tvView(changed)).toEqual(game.tvView(s));
        expect(game.controllerView(changed, 'p2')).toEqual(game.controllerView(s, 'p2'));
        expect(game.tvView(s).decision).toBeNull();
        expect(game.controllerView(s, 'p2').team?.gained).toBe(0);
        expect(JSON.stringify(game.tvView(s))).not.toMatch(/SECRET ONLY|correctChoice|elapsed/);
        if (phase === 'question') expect(game.controllerView(s, 'p2').question).toBeNull();
      }
      const reveal = kit.timer(question(mode));
      expect(game.tvView(reveal).reveal?.correctChoice).toBe(currentQuestion(reveal).correct);
    },
  );
  it('withholds final opponent totals and all unrevealed group ranks', () => {
    let s = question('teams', 8, 4);
    s = { ...s, round: s.deck.length };
    for (const [index, team] of s.teams.entries())
      for (const id of team.members) s = tap(s, id, currentQuestion(s).correct, index * 2000);
    expect(
      game
        .tvView(s)
        .teams.every((team) => team.rank === 0 && team.score === 0 && team.gained === 0),
    ).toBe(true);
    const own = game.controllerView(s, s.teams[0]!.members[0]!);
    expect(own.team).toMatchObject({ score: 1000, gained: 1000, rank: 0 });
    expect(
      own.teams
        .filter((team) => team.id !== own.team!.id)
        .every((team) => team.score === 0 && team.gained === 0),
    ).toBe(true);
    s = kit.timer(s);
    expect(game.tvView(s).standings.map((row) => row.rank)).toEqual([3]);
    expect(
      game
        .tvView(s)
        .teams.filter((team) => team.rank === 0)
        .map((team) => team.score),
    ).toEqual([0, 0]);
  });
  it('leaves default solo phases, deck RNG, points and result shape unchanged', () => {
    let s = kit.start();
    const [deck, rng] = makeDeck('general', 5, seedRng(1));
    expect(s.phase.id).toBe('question');
    expect(s.deck).toEqual(deck);
    expect(s.rng).toEqual(rng);
    expect(s.teams).toEqual([]);
    for (const id of Object.keys(s.players)) s = tap(s, id, currentQuestion(s).correct, 1000);
    expect(Object.values(s.scores)).toEqual([975, 975, 975, 975]);
    expect(game.results(kit.vip(s, 'end'))).not.toHaveProperty('outcome');
    expect(game.controllerView(s, 'p1').team).toBeNull();
  });
});
