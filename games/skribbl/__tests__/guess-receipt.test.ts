import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import type { Input } from '../server/types';
import { deepFreeze, drawing, guesser, kit } from './helpers';

describe('private guess receipts', () => {
  it('accepts the maximum legal request followed by a wrapped request with a fresh receipt', () => {
    const start = drawing();
    const id = guesser(start);
    const maximum = kit.input(
      start,
      id,
      { type: 'guess', text: 'definitely wrong', request: 1_000_000_000 },
      start.began + 1000,
    );
    expect(game.controllerView(maximum, id).guessReceipt).toEqual({
      revision: 1,
      request: 1_000_000_000,
      accepted: true,
    });
    const wrapped = kit.input(
      maximum,
      id,
      { type: 'guess', text: 'definitely wrong', request: 1 },
      start.began + 1800,
    );
    expect(game.controllerView(wrapped, id).guessReceipt).toEqual({
      revision: 2,
      request: 1,
      accepted: true,
    });
  });

  it('acknowledges same-text retries independently after the 24-guess history cap', () => {
    let state = drawing();
    const id = guesser(state);
    for (let request = 1; request <= 30; request++) {
      state = kit.input(
        state,
        id,
        { type: 'guess', text: 'definitely wrong', request },
        state.began + request * 800,
      );
      expect(game.controllerView(state, id).guessReceipt).toEqual({
        revision: request,
        request,
        accepted: true,
      });
    }
    expect(state.guesses[id]).toHaveLength(24);
  });

  it('acknowledges repeated throttle refusals without consuming guess history', () => {
    const start = deepFreeze(drawing());
    const id = guesser(start);
    let state = kit.input(
      start,
      id,
      { type: 'guess', text: 'definitely wrong', request: 1 },
      start.began + 1000,
    );
    for (const request of [2, 3]) {
      state = kit.input(
        deepFreeze(state),
        id,
        { type: 'guess', text: 'definitely wrong', request },
        start.began + 1000 + request * 100,
      );
      const view = game.controllerView(state, id);
      expect(view.feedback).toBe('Wait a moment');
      expect(view.guessReceipt).toEqual({ revision: request, request, accepted: false });
      expect(state.guesses[id]).toHaveLength(1);
    }
  });

  it('keeps receipts private and never includes a successful answer in the receipt', () => {
    const start = drawing();
    const id = guesser(start);
    const state = kit.input(start, id, { type: 'guess', text: start.word, request: 11 });
    expect(game.controllerView(state, id).guessReceipt).toEqual({
      revision: 1,
      request: 11,
      accepted: true,
    });
    expect(game.controllerView(state, id).lastGuess).toBe('');
    expect(JSON.stringify(game.controllerView(state, id))).not.toContain(start.word);
    expect(game.tvView(state)).not.toHaveProperty('guessReceipt');
    for (const other of [start.drawer, 'spectator', '__proto__', 'constructor']) {
      expect(game.controllerView(state, other).guessReceipt).toEqual({
        revision: 0,
        accepted: true,
      });
    }
  });

  it('does not acknowledge gameplay inputs that are ignored by permissions or pause', () => {
    const state = drawing();
    const input = { type: 'guess' as const, text: 'wrong', request: 1 };
    for (const id of [state.drawer, 'spectator', '__proto__']) {
      expect(kit.input(state, id, input).guessReceipts).toEqual({});
    }
    const paused = kit.vip(state, 'pause', state.began + 500);
    expect(kit.input(paused, guesser(state), input).guessReceipts).toEqual({});
    expect(kit.input(state, guesser(state), input, state.endsAt).guessReceipts).toEqual({});
  });

  it.each([null, undefined])(
    'preserves SDK-ignored malformed %s inputs while paused or done',
    (input) => {
      const start = drawing();
      for (const state of [kit.vip(start, 'pause'), kit.vip(start, 'end')]) {
        expect(
          game.reduce(state, {
            type: 'input',
            playerId: guesser(start),
            input: input as unknown as Input,
            now: start.began + 1500,
          }),
        ).toBe(state);
      }
    },
  );

  it('keeps existing bot packets valid and bounds optional client request IDs', () => {
    expect(game.inputSchema.safeParse({ type: 'guess', text: 'cat' }).success).toBe(true);
    expect(
      game.inputSchema.safeParse({ type: 'guess', text: 'cat', request: 1_000_000_000 }).success,
    ).toBe(true);
    for (const request of [0, -1, 0.5, 1_000_000_001, Infinity, NaN]) {
      expect(game.inputSchema.safeParse({ type: 'guess', text: 'cat', request }).success).toBe(
        false,
      );
    }
  });
});
