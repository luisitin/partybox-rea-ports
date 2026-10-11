// Unit tests for Quick Poll. The contract suite covers totality/determinism/termination; these
// pin the rules written in README.md (scoring, phase exits) with hand-built events.
import { describe, expect, it } from 'vitest';
import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';

const T0 = 1_000_000;

// The SDK's test kit (docs/ADDING_A_GAME.md step 9): a room of two, inputs 1 s into their phase.
const kit = testKit(game, {
  t0: T0,
  inputAt: 1000,
  players: [
    { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
    { id: 'b', name: 'Ben', avatarId: 'owl', connected: true },
  ],
  settings: { answerSeconds: 30 },
});

const start = (): State => kit.start();
const answer = (state: State, playerId: string, text: string): State =>
  kit.input(state, playerId, { type: 'answer', text });

describe('Quick Poll', () => {
  it('starts in answer with a 30 s deadline', () => {
    const s = start();
    expect(s.phase).toEqual({ id: 'answer', startedAt: T0, deadline: T0 + 30_000 });
    expect(game.results(s)).toBeNull();
  });

  it('moves to reveal once every connected player answered, scoring 1 per answer', () => {
    let s = answer(start(), 'a', 'pizza');
    expect(s.phase.id).toBe('answer');
    s = answer(s, 'b', 'tacos');
    expect(s.phase.id).toBe('reveal');
    expect(s.scores).toEqual({ a: 1, b: 1 });
  });

  it('a second answer from the same player is ignored', () => {
    const s = answer(answer(start(), 'a', 'first'), 'a', 'second');
    expect(s.answers['a']).toBe('first');
  });

  it('the deadline reveals whatever was answered; non-answerers score 0', () => {
    let s = answer(start(), 'a', 'pizza');
    s = kit.timer(s); // the answer deadline, T0 + 30 s
    expect(s.phase.id).toBe('reveal');
    expect(s.scores).toEqual({ a: 1, b: 0 });
    s = kit.timer(s);
    expect(game.results(s)?.winnerIds).toEqual(['a']);
  });

  it('a disconnected player does not block the "all answered" exit', () => {
    let s = kit.player(start(), 'b', false, undefined, T0 + 5);
    s = answer(s, 'a', 'solo');
    expect(s.phase.id).toBe('reveal');
  });

  it('hides answers from the TV until reveal and from other phones always', () => {
    const s = answer(start(), 'a', 'secretword');
    expect(JSON.stringify(game.tvView(s))).not.toContain('secretword');
    expect(JSON.stringify(game.controllerView(s, 'b'))).not.toContain('secretword');
    const mine = game.controllerView(s, 'a');
    expect(mine.submitted).toBe(true);
    expect(mine.myAnswer).toBe('secretword');
    expect(game.tvView(s).answeredCount).toBe(1);
  });
});
