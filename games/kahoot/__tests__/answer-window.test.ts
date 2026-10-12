// Donor answer-window rules: queued/early/disconnected taps never become accepted answers.
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { answerWindowOf } from '../server/types';
import { current, input, phone, pick, start, timer, toWager, vip, wager } from './helpers';

describe('question answer window', () => {
  it.each([0, 1, 5_000])('a tap %i ms past the deadline reveals without crediting it', (late) => {
    let state = timer(start());
    state = pick(state, 'b', true, answerWindowOf(state) / 10);
    const deadline = state.phase.deadline!;
    state = input(state, 'a', { type: 'pick', index: current(state).answerIndex }, deadline + late);
    expect(state.phase.id).toBe('reveal');
    expect(state.picks).not.toHaveProperty('a');
    expect(state.scores['a']).toBe(0);
    expect(state.scores['b']).toBe(950);
    expect(phone(state, 'a')).toMatchObject({
      myPickIndex: null,
      outcome: { correct: false, delta: 0 },
    });
    expect(timer(state).phase.id).toBe('question');
  });

  it('accepts the final millisecond and ignores a tap before the question opens', () => {
    const state = timer(start());
    const answer = { type: 'pick' as const, index: current(state).answerIndex };
    expect(input(state, 'a', answer, state.phase.startedAt - 1)).toBe(state);
    const accepted = input(state, 'a', answer, state.phase.deadline! - 1);
    expect(accepted.picks['a']?.elapsedMs).toBe(answerWindowOf(state) - 1);
    expect(timer(accepted).scores['a']).toBe(500);
  });

  it('a disconnected seat cannot answer; reconnect restores the same open window', () => {
    let state = timer(start());
    state = game.reduce(state, {
      type: 'player',
      playerId: 'a',
      connected: false,
      now: state.phase.startedAt + 100,
    });
    expect(pick(state, 'a', true)).toBe(state);
    state = game.reduce(state, {
      type: 'player',
      playerId: 'a',
      connected: true,
      now: state.phase.startedAt + 1_500,
    });
    expect(pick(state, 'a', true, 2_000).picks['a']?.elapsedMs).toBe(2_000);
  });

  it('pause extends the deadline without changing speed or accepting a deadline tap', () => {
    let state = timer(start());
    const began = state.phase.startedAt;
    state = vip(state, 'pause', began + 1_000);
    expect(pick(state, 'a', true, 2_000)).toBe(state);
    state = vip(state, 'resume', began + 101_000);
    state = input(state, 'a', { type: 'pick', index: current(state).answerIndex }, began + 102_000);
    expect(state.picks['a']?.elapsedMs).toBe(2_000);
    state = input(
      state,
      'b',
      { type: 'pick', index: current(state).answerIndex },
      state.phase.deadline!,
    );
    expect(state.phase.id).toBe('reveal');
    expect(state.scores['a']).toBeGreaterThanOrEqual(900);
    expect(state.scores['a']).toBeLessThan(1000);
    expect(state.picks).not.toHaveProperty('b');
  });

  it('a late final answer loses the wager, matching an unanswered deadline', () => {
    let state = toWager(start(), { a: true });
    const before = state.scores['a']!;
    state = wager(state, 'a', 100);
    state = timer(state);
    state = input(
      state,
      'a',
      { type: 'pick', index: current(state).answerIndex },
      state.phase.deadline!,
    );
    expect(state.phase.id).toBe('reveal');
    expect(state.scores['a']).toBe(0);
    expect(phone(state, 'a').outcome).toEqual({ correct: false, delta: -before });
  });
});
