// Real reducer flows model missing pushes, pause races and duplicate-safe resubmission.
import { describe, expect, it } from 'vitest';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { WordGuessControllerView } from '../server/index';
import type { State } from '../server/types';
import { submissionState, SUBMISSION_WAIT_MS } from './submission';
import type { Draft, Pending } from './submission';

const T0 = 10_000;
const SENT = T0 + 100;
const kit = testKit(game, { t0: T0, players: testPlayers(2) });
const start = (): State => ({ ...kit.start(), answers: ['apple', 'berry', 'charm'] });
const view = (state: State): WordGuessControllerView => game.controllerView(state, 'p1');

function draft(cv: WordGuessControllerView, value = 'crane'): Draft {
  return { round: cv.round, guessCount: cv.guesses.length, version: cv.submissionVersion, value };
}

function pending(cv: WordGuessControllerView, sentAt = SENT): Pending {
  return { round: cv.round, version: cv.submissionVersion, sentAt };
}

function guess(state: State, word = 'crane', now = SENT): State {
  return kit.input(state, 'p1', { type: 'guess', word, round: state.round }, now);
}

describe('bounded submit wait', () => {
  it('blocks a second submit until 2999 ms, then preserves the word and permits retry at 3000 ms', () => {
    const cv = view(start());
    const typed = draft(cv);
    const sent = pending(cv);
    expect(submissionState(cv, typed, sent, SENT + SUBMISSION_WAIT_MS - 1)).toMatchObject({
      value: 'crane',
      waiting: true,
      timedOut: false,
    });
    expect(submissionState(cv, typed, sent, SENT + SUBMISSION_WAIT_MS)).toMatchObject({
      value: 'crane',
      waiting: false,
      timedOut: true,
    });
  });

  it('recovers a submit dropped during pause without changing the draft or spending a guess', () => {
    const initial = start();
    const typed = draft(view(initial));
    const sent = pending(view(initial));
    const paused = kit.vip(initial, 'pause', SENT - 1);
    expect(guess(paused)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', SENT + 10_000);
    const ready = submissionState(view(resumed), typed, sent, SENT + 10_000);
    expect(ready).toMatchObject({ value: 'crane', waiting: false, timedOut: true });
    const accepted = guess(resumed, ready.value, SENT + 10_001);
    expect(accepted.entries.p1!.guesses).toHaveLength(1);
    expect(submissionState(view(accepted), typed, sent, SENT + 10_002)).toMatchObject({
      value: '',
      waiting: false,
      timedOut: false,
    });
  });

  it('expires even if a transient pause was never observed by the phone', () => {
    const initial = start();
    const staleView = view(initial);
    const sent = pending(staleView);
    const typed = draft(staleView);
    const paused = kit.vip(initial, 'pause', SENT - 1);
    const resumed = kit.vip(guess(paused), 'resume', SENT + 500);
    expect(resumed.entries.p1!.submissionVersion).toBe(staleView.submissionVersion);
    // No paused view or reset effect ever reached this phone.
    expect(submissionState(staleView, typed, sent, SENT + SUBMISSION_WAIT_MS).waiting).toBe(false);
    expect(
      guess(resumed, typed.value, SENT + SUBMISSION_WAIT_MS + 1).entries.p1!.guesses,
    ).toHaveLength(1);
  });

  it('recovers when a disconnected submit was ignored and reconnect keeps the same version', () => {
    const initial = start();
    const cv = view(initial);
    const disconnected = kit.player(initial, 'p1', false, undefined, SENT - 1);
    expect(guess(disconnected)).toBe(disconnected);
    const returned = kit.player(disconnected, 'p1', true, undefined, SENT + 4000);
    const ready = submissionState(view(returned), draft(cv), pending(cv), SENT + 4000);
    expect(ready).toMatchObject({ value: 'crane', waiting: false, timedOut: true });
    const accepted = guess(returned, ready.value, SENT + 4001);
    expect(accepted.entries.p1!.guesses.map((row) => row.word)).toEqual(['crane']);
  });

  it('a lost successful acknowledgement permits retry but spends one row and clears the draft', () => {
    const initial = start();
    const staleView = view(initial);
    const typed = draft(staleView);
    const first = guess(initial);
    const ready = submissionState(staleView, typed, pending(staleView), SENT + 3000);
    expect(ready.waiting).toBe(false);
    const retried = guess(first, ready.value, SENT + 3001);
    expect(retried.entries.p1!.error).toBe('You already tried that word.');
    expect(retried.entries.p1!.guesses).toHaveLength(1);
    expect(retried.entries.p1!.submissionVersion).toBe(2);
    expect(
      submissionState(view(retried), typed, pending(staleView, SENT + 3001), SENT + 3002),
    ).toEqual({
      value: '',
      waiting: false,
      timedOut: false,
      error: null,
    });
  });

  it('an acknowledgement, a phase exit or a new round releases pending controls immediately', () => {
    const initial = start();
    const cv = view(initial);
    const typed = draft(cv);
    const sent = pending(cv);
    expect(submissionState(view(guess(initial)), typed, sent, SENT + 1).waiting).toBe(false);
    const reveal = kit.vip(initial, 'skip', SENT + 1);
    expect(submissionState(view(reveal), typed, sent, SENT + 2).waiting).toBe(false);
    const next = kit.vip(reveal, 'skip', SENT + 3);
    expect(submissionState(view(next), typed, sent, SENT + 4)).toEqual({
      value: '',
      waiting: false,
      timedOut: false,
      error: null,
    });
  });
});

describe('rejected draft recovery', () => {
  it('preserves a dictionary rejection, hides its error after editing and shows a fresh rejection', () => {
    const initial = start();
    const cv = view(initial);
    const typed = draft(cv, 'zzzzz');
    const rejected = guess(initial, typed.value);
    expect(submissionState(view(rejected), typed, pending(cv), SENT + 1)).toMatchObject({
      value: 'zzzzz',
      waiting: false,
      error: 'Word not in our dictionary.',
    });
    const edited = draft(view(rejected), 'zzzza');
    expect(submissionState(view(rejected), edited, null, SENT + 2)).toMatchObject({
      value: 'zzzza',
      error: null,
    });
    const rejectedAgain = guess(rejected, edited.value, SENT + 3);
    expect(
      submissionState(view(rejectedAgain), edited, pending(view(rejected), SENT + 3), SENT + 4),
    ).toMatchObject({
      value: 'zzzza',
      waiting: false,
      error: 'Word not in our dictionary.',
    });
    expect(rejectedAgain.entries.p1!.guesses).toHaveLength(0);
  });

  it('preserves an intentional duplicate rejection on the existing board, then clears a new accepted word', () => {
    const first = guess(start());
    const cv = view(first);
    const duplicate = draft(cv);
    const rejected = guess(first, duplicate.value, SENT + 1);
    expect(
      submissionState(view(rejected), duplicate, pending(cv, SENT + 1), SENT + 2),
    ).toMatchObject({
      value: 'crane',
      error: 'You already tried that word.',
    });
    const edited = draft(view(rejected), 'house');
    expect(submissionState(view(rejected), edited, null, SENT + 3).error).toBeNull();
    const accepted = guess(rejected, edited.value, SENT + 4);
    expect(
      submissionState(view(accepted), edited, pending(view(rejected), SENT + 4), SENT + 5),
    ).toEqual({
      value: '',
      waiting: false,
      timedOut: false,
      error: null,
    });
    expect(accepted.entries.p1!.guesses).toHaveLength(2);
  });
});
