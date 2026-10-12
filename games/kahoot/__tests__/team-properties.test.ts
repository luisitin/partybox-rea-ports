// Generated traces exercise the actual reducer, including hostile but schema-valid receipts.
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { fuzzOnce, testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Input, State } from '../server/types';
import { GROUP_MODES, NEW_PACKS, STRENGTHS } from './test-team-sim';

function assertSafe(state: State, starters: string[], teams: State['teams']) {
  expect(game.phases).toContain(state.phase.id);
  expect(state.teams).toEqual(teams);
  expect(Object.keys(state.players).sort()).toEqual(starters);
  expect(Object.keys(state.scores).sort()).toEqual(starters);
  expect(state.teams.flatMap((team) => team.members).sort()).toEqual(starters);
  expect(Object.values(state.scores).every((score) => Number.isInteger(score) && score >= 0)).toBe(
    true,
  );
  for (const team of state.teams)
    expect(team.members.every((id) => state.scores[id] === state.teamScores[team.id])).toBe(true);
  for (const answer of Object.values(state.answers)) {
    expect(Number.isInteger(answer.choice) && answer.choice >= 0 && answer.choice <= 3).toBe(true);
    expect(Number.isFinite(answer.elapsed) && answer.elapsed >= 0).toBe(true);
  }
  if (state.phase.id === 'done') {
    const result = game.results(state)!;
    expect(result.ranking.map((row) => row.playerId).sort()).toEqual(starters);
    expect(result.winnerIds.slice().sort()).toEqual(
      result.ranking
        .filter((row) => row.rank === 1)
        .map((row) => row.playerId)
        .sort(),
    );
  } else expect(game.results(state)).toBeNull();
}

it('replays pure, safe group traces for seeds 1,2,3 and 1,000 independently generated seeds', () => {
  const rng = createRng(0x702);
  const seeds = [1, 2, 3, ...Array.from({ length: 1000 }, () => rng.int(4, 0x7fffffff))];
  for (const mode of GROUP_MODES)
    for (const seed of seeds) {
      const players = testPlayers(2 + (seed % 7));
      const starters = players.map((player) => player.id).sort();
      const kit = testKit(game, {
        t0: 0,
        players,
        seed,
        settings: {
          mode,
          pack: NEW_PACKS[seed % 3]!,
          rounds: 5,
          teamCount: 2 + (seed % 3),
          talkSeconds: 5,
        },
      });
      let state = kit.start();
      const initial = JSON.stringify(state);
      const teams = structuredClone(state.teams);
      expect(fuzzOnce(game, state, seed)).toEqual([]);
      expect(JSON.stringify(state)).toBe(initial);
      const generated = fc.sample(
        fc.array(fc.integer({ min: 0, max: 12 }), { minLength: 12, maxLength: 24 }),
        { seed, numRuns: 1 },
      )[0]!;
      // This prefix guarantees out-of-phase input, early/stale timers, pause, resume,
      // voting, a stale round, leave/reconnect and skip in every generated trace.
      const actions = [3, 1, 2, 5, 3, 6, 0, 4, 8, 9, 10, 7, ...generated];
      let now = 0;
      let fuzzedQuestion = false;
      for (const action of actions) {
        now = Math.max(now + 100, state.phase.startedAt + 100);
        const last = players.at(-1)!.id;
        const input: Input = { type: 'answer', round: state.round, choice: seed % 4 };
        let event: GameEvent<Input>;
        let ignored = false;
        switch (action) {
          case 0:
            now = Math.max(now, state.phase.deadline ?? now);
            event = {
              type: 'timer',
              now,
              phaseId: state.phase.id,
              startedAt: state.phase.startedAt,
            };
            break;
          case 1:
            event = {
              type: 'timer',
              now: (state.phase.deadline ?? now) - 1,
              phaseId: state.phase.id,
              startedAt: state.phase.startedAt,
            };
            ignored = true;
            break;
          case 2:
            event = {
              type: 'timer',
              now,
              phaseId: state.phase.id,
              startedAt: state.phase.startedAt - 1,
            };
            ignored = true;
            break;
          case 3:
            event = { type: 'input', now, playerId: players[seed % players.length]!.id, input };
            ignored = state.phase.id !== 'question' || state.phase.paused !== undefined;
            break;
          case 4:
            event = {
              type: 'input',
              now,
              playerId: 'p1',
              input: { ...input, round: state.round === 20 ? 19 : state.round + 1 },
            };
            ignored = true;
            break;
          case 5:
            event = { type: 'vip', now, action: 'pause' };
            break;
          case 6:
            event = { type: 'vip', now, action: 'resume' };
            break;
          case 7:
            event = { type: 'vip', now, action: 'skip' };
            break;
          case 8:
            event = { type: 'player', now, playerId: last, connected: false };
            break;
          case 9:
            event = { type: 'player', now, playerId: last, connected: true };
            break;
          case 10:
            event = { type: 'player', now, playerId: last, connected: false, gone: 'left' };
            break;
          case 11:
            event = { type: 'input', now, playerId: '__proto__', input };
            ignored = true;
            break;
          default:
            event = { type: 'vip', now, action: 'end' };
        }
        if (event.type === 'input')
          expect(game.inputSchema.safeParse(event.input).success).toBe(true);
        const before = JSON.stringify(state);
        const next = game.reduce(state, event);
        expect(JSON.stringify(state)).toBe(before);
        expect(game.reduce(JSON.parse(before), event)).toEqual(next);
        expect(JSON.parse(JSON.stringify(next))).toEqual(next);
        if (ignored) expect(next).toEqual(state);
        for (const id of starters)
          expect(next.scores[id]!).toBeGreaterThanOrEqual(state.scores[id]!);
        assertSafe(next, starters, teams);
        if (next.phase.id === 'question' && !fuzzedQuestion) {
          const serialized = JSON.stringify(next);
          expect(fuzzOnce(game, next, seed)).toEqual([]);
          expect(JSON.stringify(next)).toBe(serialized);
          fuzzedQuestion = true;
        }
        state = next;
      }
      if (state.phase.paused) state = kit.vip(state, 'resume', now + 100);
      state = kit.until(state, 'done', 200);
      assertSafe(state, starters, teams);
      expect(kit.vip(state, 'end', state.phase.startedAt + 100)).toEqual(state);
      expect(JSON.stringify(kit.start())).toBe(initial);
    }
}, 60_000);

it('rejects malformed payloads at the SDK schema boundary', () => {
  for (const input of [
    null,
    {},
    { type: 'answer', round: 0, choice: 0 },
    { type: 'answer', round: 21, choice: 0 },
    { type: 'answer', round: 1, choice: 4 },
    { type: 'answer', round: 1, choice: -1 },
    { type: 'answer', round: 1, choice: 1.5 },
    { type: 'answer', round: '1', choice: 0 },
    { type: 'guess', round: 1, choice: 0 },
  ])
    expect(game.inputSchema.safeParse(input).success).toBe(false);
});

it('hides keys and other players’ choices throughout discussion and voting', () => {
  for (const mode of GROUP_MODES) {
    const kit = testKit(game, { players: testPlayers(4), settings: { mode, pack: 'music' } });
    let state = kit.start({ presence: { mode: 'together', phoneOnly: true } });
    const changedSecrets = (source: State): State => ({
      ...source,
      deck: source.deck.map((question) => ({
        ...question,
        correct: (question.correct + 1) % 4,
        explanation: 'Hidden replacement explanation.',
        difficulty: (question.difficulty === 1 ? 3 : 1) as typeof question.difficulty,
      })),
    });
    expect(state.phase.id).toBe('talk');
    expect(kit.tv(state).reveal).toBeNull();
    expect(kit.tv(state).decision).toBeNull();
    expect(kit.tv(changedSecrets(state))).toEqual(kit.tv(state));
    for (const player of Object.values(state.players)) {
      expect(kit.cv(state, player.id).question).not.toBeNull();
      expect(kit.cv(changedSecrets(state), player.id)).toEqual(kit.cv(state, player.id));
      for (const strength of STRENGTHS)
        expect(game.bot.sampleInput(state, player.id, createRng(7), strength)).toBeNull();
    }
    const early = { type: 'answer' as const, round: state.round, choice: 0 };
    expect(kit.input(state, 'p1', early)).toEqual(state);
    state = kit.timer(state);
    expect(state.phase.id).toBe('question');
    state = kit.input(state, 'p2', { ...early, round: state.round }, state.openedAt + 500);
    const changed = changedSecrets(state);
    changed.answers = { ...changed.answers, p2: { choice: 3, elapsed: 999 } };
    expect(kit.tv(changed)).toEqual(kit.tv(state));
    for (const id of ['p1', 'p3', 'p4', 'spectator'])
      expect(kit.cv(changed, id)).toEqual(kit.cv(state, id));
    expect(kit.cv(state, 'p2').submitted).toBe(true);
    expect(kit.cv(state, 'p2').selected).toBe(0);
  }
});

it('pause preserves a vote and excludes paused time from later answer speed', () => {
  for (const mode of GROUP_MODES) {
    const kit = testKit(game, { players: testPlayers(3), settings: { mode } });
    let state = kit.timer(kit.start());
    const answer = { type: 'answer' as const, round: state.round, choice: state.deck[0]!.correct };
    state = kit.input(state, 'p1', answer, state.openedAt + 1000);
    const openedAt = state.openedAt;
    state = kit.vip(state, 'pause', openedAt + 1500);
    expect(kit.input(state, 'p2', answer, openedAt + 2000)).toEqual(state);
    expect(kit.timer(state, openedAt + 100_000)).toEqual(state);
    state = kit.vip(state, 'resume', openedAt + 61_500);
    expect(state.openedAt).toBe(openedAt + 60_000);
    expect(state.answers.p1).toEqual({ choice: answer.choice, elapsed: 1000 });
    state = kit.input(state, 'p2', answer, state.openedAt + 2000);
    expect(state.answers.p2!.elapsed).toBe(2000);
    expect(
      kit.input(state, 'p1', { ...answer, choice: (answer.choice + 1) % 4 }, state.openedAt + 2500),
    ).toEqual(state);
  }
});

it('unequal-sized teams receive the same performance credit once, including the next streak', () => {
  const kit = testKit(game, {
    players: testPlayers(8),
    settings: { mode: 'teams', teamCount: 3, rounds: 5 },
  });
  let state = kit.timer(kit.start());
  expect(new Set(state.teams.map((team) => team.members.length)).size).toBe(2);
  for (const total of [750, 1600]) {
    const answer = {
      type: 'answer' as const,
      round: state.round,
      choice: state.deck[state.round - 1]!.correct,
    };
    const staleTimer = {
      type: 'timer' as const,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
      now: state.phase.deadline!,
    };
    for (const id of Object.keys(state.players))
      state = kit.input(state, id, answer, state.openedAt + state.answerMs / 2);
    expect(state.phase.id).toBe('reveal');
    expect(Object.values(state.teamScores)).toEqual([total, total, total]);
    expect(Object.values(state.scores)).toEqual(Array(8).fill(total));
    expect(game.reduce(state, staleTimer)).toEqual(state);
    expect(kit.input(state, 'p1', answer, state.phase.startedAt + 1)).toEqual(state);
    if (total === 750) state = kit.until(state, 'question');
  }
});

it('room plurality credits every starter together, including a dissenting voter', () => {
  const kit = testKit(game, { players: testPlayers(8), settings: { mode: 'tv-vote', rounds: 5 } });
  let state = kit.timer(kit.start());
  const correct = state.deck[0]!.correct;
  const at = state.openedAt + state.answerMs / 2;
  for (let seat = 0; seat < 8; seat++)
    state = kit.input(
      state,
      `p${seat + 1}`,
      { type: 'answer', round: 1, choice: seat < 4 ? correct : (correct + 1 + (seat % 2)) % 4 },
      at,
    );
  expect(state.phase.id).toBe('reveal');
  expect(state.decision).toBe(correct);
  expect(Object.values(state.scores)).toEqual(Array(8).fill(750));
  expect(Object.values(state.verdicts).every((verdict) => verdict.outcome === 'correct')).toBe(
    true,
  );
  expect(kit.cv(state, 'p8').verdict!.points).toBe(750);
  const before = structuredClone(state.teamScores);
  state = kit.player(state, 'p8', false, 'left', state.phase.startedAt + 1);
  expect(state.teamScores).toEqual(before);
  state = kit.until(state, 'done');
  expect(game.results(state)!.ranking).toHaveLength(8);
  expect(game.results(state)!.winnerIds.slice().sort()).toEqual(Object.keys(state.players).sort());
});

it('offline nonvoters do not dilute a team, and reconnecting keeps its fixed membership', () => {
  const kit = testKit(game, { players: testPlayers(6), settings: { mode: 'teams', teamCount: 2 } });
  let state = kit.timer(kit.start());
  const teams = structuredClone(state.teams);
  const offline = state.teams[0]!.members[0]!;
  const at = state.openedAt + state.answerMs / 2;
  state = kit.player(state, offline, false, undefined, at - 100);
  for (const id of Object.keys(state.players).filter((id) => id !== offline))
    state = kit.input(
      state,
      id,
      { type: 'answer', round: state.round, choice: state.deck[state.round - 1]!.correct },
      at,
    );
  expect(state.phase.id).toBe('reveal');
  expect(Object.values(state.teamScores)).toEqual([750, 750]);
  state = kit.player(state, offline, true, undefined, at + 100);
  expect(state.teams).toEqual(teams);
  state = kit.player(state, offline, false, 'kicked', at + 200);
  state = kit.until(state, 'done');
  expect(
    game
      .results(state)!
      .ranking.map((row) => row.playerId)
      .sort(),
  ).toEqual(Object.keys(state.players).sort());
});
