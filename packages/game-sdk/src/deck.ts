// A deck of content ids drawn from the front (audit #17): cards, prompts, questions. The refill is
// shuffled with the game's rng, so the same seed draws the same cards. Pure.
import { shuffle } from '@partybox/shared';
import type { RngState } from '@partybox/shared';

export interface DeckDraw<T> {
  /** Up to `count` ids, front first (short when the deck and its refill run dry). */
  drawn: T[];
  /** What is left, in order. */
  deck: T[];
  rng: RngState;
  /** True when `refill` was shuffled in (a discard pile is then used up). */
  refilled: boolean;
}

/**
 * Takes `count` ids off the front of `deck`. When fewer are left, `refill` (a discard pile, or the
 * whole pool again) is shuffled once and put behind them first, skipping ids the deck still holds.
 * A game's first draw is `drawFromDeck(rng, [], n, pool)`: the pool shuffled, `n` off the top.
 */
export function drawFromDeck<T>(
  rng: RngState,
  deck: readonly T[],
  count: number,
  refill: readonly T[],
): DeckDraw<T> {
  let cards: T[] = [...deck];
  let next = rng;
  const refilled = cards.length < count && refill.length > 0;
  if (refilled) {
    const [order, after] = shuffle(next, refill);
    next = after;
    cards = [...cards, ...order.filter((id) => !deck.includes(id))];
  }
  return { drawn: cards.slice(0, count), deck: cards.slice(count), rng: next, refilled };
}
