// Fair comparisons and one-time credit independent of phase timing or network state.
import { describe, expect, it } from 'vitest';
import { testKit } from '@partybox/game-sdk/testing';
import { game } from './index';
import { beats, roundPoints, settleRound } from './scoring';
import { emptyEntry } from './types';
import type { Entry, State } from './types';

function entry(attempts: number, solvedElapsedMs: number | null): Entry {
  return {
    ...emptyEntry(),
    solvedElapsedMs,
    guesses: Array.from({ length: attempts }, () => ({
      word: 'apple',
      marks: ['correct', 'correct', 'correct', 'correct', 'correct'],
    })),
  };
}

const kit = testKit(game);
function scored(a: Entry, b: Entry, c: Entry, d: Entry): State {
  return { ...kit.start(), entries: { p1: a, p2: b, p3: c, p4: d } };
}

describe('pairwise standings', () => {
  it('a solved word beats every miss, independent of attempts or speed', () => {
    expect(beats(entry(6, 119_000), entry(1, null))).toBe(true);
    expect(beats(entry(1, null), entry(6, 119_000))).toBe(false);
    expect(beats(entry(1, null), entry(6, null))).toBe(false);
    expect(beats(entry(6, null), entry(1, null))).toBe(false);
  });

  it('fewer guesses takes priority over an earlier solve', () => {
    expect(beats(entry(2, 90_000), entry(3, 200))).toBe(true);
    expect(beats(entry(3, 200), entry(2, 90_000))).toBe(false);
  });

  it('active time decides equal guess counts; exact time ties earn no mutual point', () => {
    expect(beats(entry(2, 400), entry(2, 500))).toBe(true);
    expect(beats(entry(2, 500), entry(2, 400))).toBe(false);
    expect(beats(entry(2, 400), entry(2, 400))).toBe(false);
    expect(beats(entry(1, 0), entry(1, 1))).toBe(true);
  });

  it('counts only beaten opponents, never the player themself', () => {
    const state = scored(entry(1, 500), entry(2, 400), entry(2, 400), entry(0, null));
    expect(roundPoints(state)).toEqual({ p1: 3, p2: 1, p3: 1, p4: 0 });
  });

  it('credits once, preserves prior rounds, and gives finite results to departed players', () => {
    let state = scored(entry(1, 500), entry(2, 400), entry(2, 400), entry(0, null));
    state = { ...state, scores: { p1: 2, p2: 1, p3: 0, p4: 3 } };
    const settled = settleRound(state);
    expect(settled.scores).toEqual({ p1: 5, p2: 2, p3: 1, p4: 3 });
    expect(settleRound(settled)).toBe(settled);
    expect(state.scores).toEqual({ p1: 2, p2: 1, p3: 0, p4: 3 });
    const done = kit.vip(kit.player(settled, 'p4', false, 'left'), 'end');
    expect(
      game
        .results(done)
        ?.ranking.map((row) => row.playerId)
        .sort(),
    ).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(game.results(done)?.scores).toEqual(settled.scores);
  });
});
