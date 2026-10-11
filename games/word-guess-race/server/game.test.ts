// Reducer rules, network transitions, clock fairness and strict private-letter views.
import { describe, expect, it } from 'vitest';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { ACCEPTED, ANSWERS } from './content';
import { game } from './index';
import { MAX_GUESSES, REVEAL_MS, ROUNDS } from './types';
import type { Input, State } from './types';

const kit = testKit(game, { players: testPlayers(3), t0: 10_000, inputAt: 100 });
const start = (): State => ({ ...kit.start(), answers: ['apple', 'berry', 'charm'] });
const guess = (s: State, id: string, word: string, now = s.began + 100): State =>
  kit.input(s, id, { type: 'guess', word, round: s.round }, now);
const solve = (s: State, id: string, now = s.began + 100): State =>
  guess(s, id, s.answers[s.round - 1]!, now);

describe('the three-round race', () => {
  it('starts guessing directly with three distinct seeded answers and a 120-second clock', () => {
    const state = kit.start();
    expect(state.phase).toEqual({ id: 'guess', startedAt: 10_000, deadline: 130_000 });
    expect(state.answers).toHaveLength(ROUNDS);
    expect(new Set(state.answers).size).toBe(ROUNDS);
    expect(state.answers.every((word) => ANSWERS.includes(word) && ACCEPTED.includes(word))).toBe(
      true,
    );
    expect(kit.start()).toEqual(state);
    expect(game.results(state)).toBeNull();
    expect(game.tvView(state).solution).toBeNull();
    expect(state.scores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it('applies valid round settings using the same defaults and bounds as the lobby', () => {
    expect(kit.start({ settings: { roundSeconds: 60 } }).phase.deadline).toBe(70_000);
    expect(kit.start({ settings: { roundSeconds: 180 } }).phase.deadline).toBe(190_000);
    for (const stale of [-5, 999, 'bogus']) {
      const s = kit.start({ settings: { roundSeconds: stale } });
      expect(s.settings.roundSeconds).toBeGreaterThanOrEqual(60);
      expect(s.settings.roundSeconds).toBeLessThanOrEqual(180);
    }
  });

  it('acknowledges format and dictionary errors privately without consuming an attempt', () => {
    let state = guess(start(), 'p1', 'abc');
    expect(state.entries.p1!.error).toBe('Use exactly five letters.');
    state = guess(state, 'p1', 'zzzzz');
    expect(state.entries.p1!.error).toBe('Word not in our dictionary.');
    expect(state.entries.p1!.guesses).toHaveLength(0);
    expect(state.entries.p1!.submissionVersion).toBe(2);
    expect(game.controllerView(state, 'p2').error).toBeNull();
    state = guess(state, 'p1', '  CRANE  ');
    expect(state.entries.p1!.guesses[0]!.word).toBe('crane');
    expect(state.entries.p1!.error).toBeNull();
    expect(state.entries.p1!.submissionVersion).toBe(3);
  });

  it('a duplicate after normalization consumes no guess and keeps feedback unchanged', () => {
    const first = guess(start(), 'p1', 'crane');
    const again = guess(first, 'p1', ' CRANE ');
    expect(again.entries.p1!.guesses).toEqual(first.entries.p1!.guesses);
    expect(again.entries.p1!.error).toBe('You already tried that word.');
    expect(again.entries.p1!.submissionVersion).toBe(2);
  });

  it('a correct word locks its six-letter-feedback row and exact solve time', () => {
    const solved = solve(start(), 'p1', 11_500);
    expect(solved.entries.p1!.solvedElapsedMs).toBe(1500);
    expect(solved.entries.p1!.guesses[0]!.marks).toEqual(Array(5).fill('correct'));
    expect(guess(solved, 'p1', 'crane')).toBe(solved);
    expect(game.controllerView(solved, 'p1').finished).toBe(true);
    expect(game.controllerView(solved, 'p1').solved).toBe(true);
    expect(game.tvView(solved).solution).toBeNull();
  });

  it('six distinct misses exhaust a player and every connected finisher triggers reveal', () => {
    let state = start();
    for (const word of ['crane', 'berry', 'chair', 'house', 'light', 'mouse'])
      state = guess(state, 'p1', word);
    expect(state.entries.p1!.guesses).toHaveLength(MAX_GUESSES);
    expect(game.controllerView(state, 'p1').finished).toBe(true);
    expect(game.controllerView(state, 'p1').solved).toBe(false);
    expect(guess(state, 'p1', 'plant')).toBe(state);
    state = solve(solve(state, 'p2', 11_000), 'p3', 11_001);
    expect(state.phase.id).toBe('reveal');
    expect(state.phase.deadline).toBe(state.phase.startedAt + REVEAL_MS);
    expect(state.lastPoints).toEqual({ p1: 0, p2: 2, p3: 1 });
  });

  it('reveal shows only the current solution, then starts a fresh history and keeps match points', () => {
    let state = kit.timer(solve(start(), 'p1'));
    expect(game.tvView(state).solution).toBe('apple');
    expect(state.scores).toEqual({ p1: 2, p2: 0, p3: 0 });
    const saved = { ...state.scores };
    state = kit.timer(state);
    expect(state.round).toBe(2);
    expect(state.phase.id).toBe('guess');
    expect(state.entries.p1!.guesses).toHaveLength(0);
    expect(state.entries.p1!.submissionVersion).toBe(0);
    expect(state.roundScored).toBe(false);
    expect(state.lastPoints).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(state.scores).toEqual(saved);
    expect(game.tvView(state).solution).toBeNull();
  });

  it('all idle players terminate after exactly three rounds, with all zero-score results', () => {
    let state = start();
    for (let round = 1; round <= ROUNDS; round++) {
      expect(state.round).toBe(round);
      state = kit.timer(state);
      expect(state.phase.id).toBe('reveal');
      state = kit.timer(state);
    }
    expect(state.phase.id).toBe('done');
    expect(game.results(state)?.scores).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(game.results(state)?.winnerIds).toHaveLength(3);
    expect(kit.timer(state)).toBe(state);
  });

  it('ignores early, stale and wrongly named timers', () => {
    const state = start();
    expect(kit.timer(state, state.began + 50)).toBe(state);
    for (const mismatch of [
      { phaseId: 'reveal', startedAt: state.phase.startedAt },
      { phaseId: 'guess', startedAt: state.phase.startedAt - 1 },
    ])
      expect(game.reduce(state, { type: 'timer', now: state.phase.deadline!, ...mismatch })).toBe(
        state,
      );
  });

  it('rejects guesses at the deadline and time travelling inputs; a delayed prior-round guess is inert', () => {
    const state = start();
    expect(solve(state, 'p1', state.began - 1)).toBe(state);
    const expired = solve(state, 'p1', state.phase.deadline!);
    expect(expired.phase.id).toBe('reveal');
    expect(expired.entries.p1!.guesses).toHaveLength(0);
    const next = kit.timer(expired);
    expect(
      kit.input(next, 'p1', { type: 'guess', word: 'berry', round: 1 }, next.began + 100),
    ).toBe(next);
  });

  it('VIP skip settles a partial round and VIP end settles it once without losing anyone', () => {
    const state = solve(start(), 'p1');
    const skipped = kit.vip(state, 'skip');
    expect(skipped.phase.id).toBe('reveal');
    expect(skipped.scores.p1).toBe(2);
    expect(kit.vip(skipped, 'end').scores.p1).toBe(2);
    const ended = kit.vip(state, 'end');
    expect(ended.phase.id).toBe('done');
    expect(ended.scores.p1).toBe(2);
    expect(kit.vip(ended, 'end')).toBe(ended);
  });
});

describe('reconnection and pauses', () => {
  it("keeps a dropped player's history and progress, accepting another guess after reconnect", () => {
    const state = guess(start(), 'p1', 'crane');
    const dropped = kit.player(state, 'p1', false);
    expect(dropped.entries.p1).toEqual(state.entries.p1);
    expect(guess(dropped, 'p1', 'house')).toBe(dropped);
    const returned = guess(kit.player(dropped, 'p1', true), 'p1', 'house');
    expect(returned.entries.p1!.guesses.map((row) => row.word)).toEqual(['crane', 'house']);
  });

  it('does not wait on a dropped unfinished player once all remaining seats finish', () => {
    const solved = solve(solve(start(), 'p1'), 'p2');
    const dropped = kit.player(solved, 'p3', false, 'left');
    expect(dropped.phase.id).toBe('reveal');
    expect(Object.keys(game.results(kit.vip(dropped, 'end'))!.scores)).toHaveLength(3);
  });

  it('never closes early merely because every phone is disconnected', () => {
    let state = start();
    for (const id of ['p1', 'p2', 'p3']) state = kit.player(state, id, false);
    expect(state.phase.id).toBe('guess');
    expect(kit.timer(state).phase.id).toBe('reveal');
  });

  it('blocks inputs and timers while paused and excludes the hold from solve time', () => {
    const state = start();
    const paused = kit.vip(state, 'pause', state.began + 1000);
    expect(solve(paused, 'p1', state.began + 2000)).toBe(paused);
    expect(kit.timer(paused)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', state.began + 11_000);
    expect(resumed.phase.deadline).toBe(state.phase.deadline! + 10_000);
    expect(resumed.began).toBe(state.began + 10_000);
    expect(solve(resumed, 'p1', state.began + 12_000).entries.p1!.solvedElapsedMs).toBe(2000);
  });

  it('a paused disconnect is rechecked on resume, and skip resumes the clock before judging', () => {
    let state = solve(solve(start(), 'p1'), 'p2');
    state = kit.vip(state, 'pause', 11_000);
    state = kit.player(state, 'p3', false, undefined, 12_000);
    expect(state.phase.id).toBe('guess');
    expect(kit.vip(state, 'resume', 21_000).phase.id).toBe('reveal');
    expect(kit.vip(state, 'skip', 21_000).phase.id).toBe('reveal');
  });
});

describe('public clues and private letters', () => {
  it('TV and other phones never receive guessed words; owner sees only their own history', () => {
    const state = guess(guess(start(), 'p1', 'crane'), 'p2', 'house');
    const tv = JSON.stringify(game.tvView(state));
    expect(tv).not.toContain('crane');
    expect(tv).not.toContain('house');
    expect(tv).not.toContain('apple');
    expect(game.tvView(state).grids[0]!.rows).toEqual([state.entries.p1!.guesses[0]!.marks]);
    const own = game.controllerView(state, 'p1');
    expect(own.guesses.map((row) => row.word)).toEqual(['crane']);
    expect(JSON.stringify(own)).not.toContain('house');
    expect(JSON.stringify(own)).not.toContain('apple');
    expect(game.controllerView(state, 'p2').guesses.map((row) => row.word)).toEqual(['house']);
    expect(JSON.stringify(game.controllerView(state, 'p2'))).not.toContain('crane');
    const reveal = kit.timer(state);
    expect(game.tvView(reveal).solution).toBe('apple');
    expect(JSON.stringify(game.tvView(reveal))).not.toContain('crane');
    expect(JSON.stringify(game.tvView(reveal))).not.toContain('house');
    expect(JSON.stringify(game.controllerView(reveal, 'p1'))).not.toContain('house');
  });

  it('unknown and prototype-like ids are safe spectators who cannot edit the game', () => {
    const state = guess(start(), 'p1', 'crane');
    for (const id of ['ghost', '', '__proto__', 'constructor', 'toString']) {
      expect(guess(state, id, 'apple')).toBe(state);
      expect(kit.player(state, id, false)).toBe(state);
      const cv = game.controllerView(state, id);
      expect(cv.me.role).toBe('spectator');
      expect(cv.guesses).toEqual([]);
      expect(cv.rank).toBeNull();
      expect(cv.stage).toBe(true);
      expect(cv.finished).toBe(true);
    }
    expect(
      game.inputSchema.safeParse({ type: 'guess', word: 'a'.repeat(65), round: 1 }).success,
    ).toBe(false);
    expect(game.inputSchema.safeParse({ type: 'guess', word: 'apple', round: 0 }).success).toBe(
      false,
    );
    expect(
      kit.input(state, 'p1', { type: 'other', word: 'apple', round: 1 } as unknown as Input),
    ).toBe(state);
  });

  it('stage phones work in phone-only and remote rooms, and ranks share exact ties', () => {
    expect(game.controllerView(start(), 'p1').stage).toBe(false);
    for (const mode of ['together', 'remote-voice', 'remote-text'] as const) {
      const state = kit.start({ presence: { mode, phoneOnly: true } });
      expect(game.controllerView(state, 'p1').stage).toBe(true);
      expect(game.controllerView(state, 'p1').ranks).toEqual({ p1: 1, p2: 1, p3: 1 });
    }
    const players = testPlayers(3).map((p) => ({ ...p, canSeeTv: false }));
    expect(game.controllerView(kit.start({ players }), 'p1').stage).toBe(true);
  });

  it('views own their arrays and maps, so a client cannot mutate game state through a view', () => {
    const state = guess(start(), 'p1', 'crane');
    const before = JSON.stringify(state);
    const tv = game.tvView(state);
    tv.scores.p1 = 999;
    tv.grids[0]!.rows[0]![0] = 'correct';
    const cv = game.controllerView(state, 'p1');
    cv.guesses[0]!.marks[0] = 'correct';
    expect(JSON.stringify(state)).toBe(before);
  });
});
