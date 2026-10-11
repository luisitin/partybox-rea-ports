// drawFromDeck (audit #17) against the draws it replaced: the same cards, the same deck left and
// the same rng after, refill or not — golden runs rarely reach a refill, so it is pinned here.
import { describe, expect, it } from 'vitest';
import { seedRng, shuffle } from '@partybox/shared';
import type { RngState } from '@partybox/shared';
import { drawFromDeck } from './deck';

const ids = (prefix: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** Blanks' drawWhite before T-0067: a short deck takes the shuffled discard pile behind it. */
function blanksDraw(rng: RngState, deck: string[], discard: string[], count: number) {
  let d = deck;
  let pile = discard;
  let r = rng;
  if (d.length < count && pile.length > 0) {
    const [refill, next] = shuffle(r, pile);
    r = next;
    d = [...d, ...refill];
    pile = [];
  }
  return { drawn: d.slice(0, count), deck: d.slice(count), rng: r, discard: pile };
}

/** Wisecrack's draw before T-0067: a short deck takes the shuffled pool, minus what it holds. */
function wisecrackDraw(rng: RngState, deck: string[], pool: string[], count: number) {
  let d = deck;
  let r = rng;
  if (d.length < count) {
    const [refill, next] = shuffle(r, pool);
    r = next;
    d = [...d, ...refill.filter((id) => !d.includes(id))];
  }
  return { drawn: d.slice(0, count), deck: d.slice(count), rng: r };
}

describe('drawFromDeck', () => {
  it("matches Blanks' discard refill for every deck size, with and without a pile", () => {
    for (let seed = 1; seed <= 40; seed++)
      for (const [left, pile, count] of [
        [10, 5, 3],
        [2, 6, 4],
        [0, 7, 5],
        [1, 0, 3],
        [0, 0, 2],
      ] as const) {
        const rng = seedRng(seed);
        const deck = ids('w', left);
        const discard = ids('d', pile);
        const want = blanksDraw(rng, deck, discard, count);
        const got = drawFromDeck(rng, deck, count, discard);
        expect({ ...got, discard: got.refilled ? [] : discard }).toEqual({
          ...want,
          refilled: got.refilled,
        });
      }
  });

  it("matches Wisecrack's pool refill, which skips ids the deck still holds", () => {
    const pool = ids('p', 12);
    for (let seed = 1; seed <= 40; seed++)
      for (const [deck, count] of [
        [['p3', 'p7'], 5],
        [pool.slice(0, 8), 4],
        [[], 6],
      ] as const) {
        const rng = seedRng(seed);
        const got = drawFromDeck(rng, deck, count, pool);
        const { refilled: _, ...rest } = got;
        expect(rest).toEqual(wisecrackDraw(rng, [...deck], pool, count));
      }
  });

  it('a first draw from an empty deck is the pool shuffled, n off the top', () => {
    const pool = ids('q', 20);
    const [shuffled, after] = shuffle(seedRng(9), pool);
    expect(drawFromDeck(seedRng(9), [], 6, pool)).toEqual({
      drawn: shuffled.slice(0, 6),
      deck: shuffled.slice(6),
      rng: after,
      refilled: true,
    });
  });

  it('leaves the rng alone when the deck has enough', () => {
    const rng = seedRng(3);
    const got = drawFromDeck(rng, ['a', 'b', 'c'], 2, ['x', 'y']);
    expect(got).toEqual({ drawn: ['a', 'b'], deck: ['c'], rng, refilled: false });
  });
});
