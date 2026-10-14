import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import type { State } from '../server/types';
import { deepFreeze, drawing, guesser, kit } from './helpers';

function withWord(word: string): State {
  return { ...drawing(), word, hintOrder: [...word].map((_, i) => i), hintCount: 0 };
}

describe('private one-edit spelling feedback', () => {
  it.each(['ca', 'at', 'ct', 'caat', 'xcat', 'catx', 'xat', 'cxt', 'cax'])(
    'marks %s as close to cat without solving or awarding points',
    (text) => {
      const start = deepFreeze(withWord('cat'));
      const id = guesser(start);
      const state = kit.input(start, id, { type: 'guess', text }, start.began + 1000);
      expect(game.controllerView(state, id).feedback).toBe('Close!');
      expect(state.solved).toEqual(start.solved);
      expect(state.scores).toEqual(start.scores);
      expect(state.gains).toEqual(start.gains);
      expect(state.phase.id).toBe('draw');
    },
  );

  it.each(['c', 'cxxat', 'xxcat', 'catxx', 'act', 'batx', 'dog', ''])(
    'does not call two or more edits close: %s',
    (text) => {
      const start = withWord('cat');
      const id = guesser(start);
      // A punctuation-only packet is legal, but its normalized answer is empty.
      const state = kit.input(
        start,
        id,
        { type: 'guess', text: text || '!!!' },
        start.began + 1000,
      );
      expect(game.controllerView(state, id).feedback).toBe('Try another word');
      expect(state.scores).toEqual(start.scores);
      expect(state.solved).toEqual({});
    },
  );

  it.each([' THE Ice--  creem!!! ', 'an ICE CREM?', ' a ice  creeam! '])(
    'compares normalized compact phrases for private feedback: %s',
    (text) => {
      const start = withWord('ice cream');
      const id = guesser(start);
      const state = kit.input(start, id, { type: 'guess', text }, start.began + 1000);
      expect(game.controllerView(state, id).feedback).toBe('Close!');
      expect(state.scores).toEqual(start.scores);
      expect(state.solved).toEqual({});
    },
  );

  it('normalizes the target too, while exact normalized answers retain ordinary points', () => {
    const start = withWord('The ice-cream!');
    const id = guesser(start);
    const close = kit.input(start, id, { type: 'guess', text: 'ice crem' }, start.began + 1000);
    expect(game.controllerView(close, id).feedback).toBe('Close!');
    const exact = kit.input(
      close,
      id,
      { type: 'guess', text: ' THE ICE  CREAM!! ' },
      start.began + 6000,
    );
    expect(game.controllerView(exact, id).feedback).toBe('Correct!');
    expect(exact.solved[id]).toBe(860);
    expect(exact.scores[id]).toBe(860);
    expect(exact.scores[start.drawer]).toBe(250);
    expect(exact.gains[id]).toBe(860);
    expect(exact.gains[start.drawer]).toBe(250);
    const repeated = kit.input(exact, id, { type: 'guess', text: 'ice cream' }, start.began + 7000);
    expect(repeated.scores).toEqual(exact.scores);
    expect(repeated.solved).toEqual(exact.solved);
  });

  it('keeps near guesses and verdicts private, including spectator and prototype IDs', () => {
    const start = withWord('cat');
    const id = guesser(start);
    const text = 'THE CAAT!!!';
    const state = kit.input(start, id, { type: 'guess', text }, start.began + 1000);
    expect(game.controllerView(state, id).feedback).toBe('Close!');
    expect(game.controllerView(state, id).lastGuess).toBe(text);
    expect(game.controllerView(state, id).secret).toBeUndefined();
    expect(game.controllerView(state, id).answer).toBeUndefined();
    expect(game.tvView(state)).toEqual(game.tvView(start));
    const otherGuesser = start.order.find((other) => other !== id && other !== start.drawer)!;
    for (const other of [otherGuesser, start.drawer, 'spectator', '__proto__', 'constructor']) {
      expect(game.controllerView(state, other)).toEqual(game.controllerView(start, other));
      expect(game.controllerView(state, other).feedback).toBe('');
      expect(game.controllerView(state, other).lastGuess).toBe('');
    }
    for (const other of ['spectator', '__proto__', 'constructor']) {
      expect(kit.input(start, other, { type: 'guess', text }).feedback).toEqual({});
      expect(kit.input(start, other, { type: 'guess', text }).scores).toEqual(start.scores);
    }
  });

  it('retains throttling, input bounds and deterministic immutable reduction', () => {
    const start = deepFreeze(withWord('cat'));
    const id = guesser(start);
    const event = deepFreeze({
      type: 'input' as const,
      playerId: id,
      input: { type: 'guess' as const, text: 'caat' },
      now: start.began + 1000,
    });
    const state = game.reduce(start, event);
    expect(game.reduce(start, event)).toEqual(state);
    expect(start.guesses).toEqual({});
    expect(start.feedback).toEqual({});
    const throttled = kit.input(
      deepFreeze(state),
      id,
      { type: 'guess', text: 'cat' },
      start.began + 1700,
    );
    expect(game.controllerView(throttled, id).feedback).toBe('Wait a moment');
    expect(throttled.guesses).toEqual(state.guesses);
    expect(throttled.solved).toEqual({});
    expect(throttled.scores).toEqual(start.scores);
    expect(game.inputSchema.safeParse({ type: 'guess', text: 'x'.repeat(40) }).success).toBe(true);
    expect(game.inputSchema.safeParse({ type: 'guess', text: 'x'.repeat(41) }).success).toBe(false);
  });
});
