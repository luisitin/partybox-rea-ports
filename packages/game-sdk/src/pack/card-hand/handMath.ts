// CardHand's geometry and ordering, pure so it is tested without a browser (docs/sdk/card-hand.md).
// A hand is one overlapping fan along the bottom of the phone; when the cards would overlap past a
// readable sliver it becomes two (or three) overlapping rows. Never a scroll, never off screen.
import type { HandSort, SortCard } from './types';

/** A poker card: width / height. */
export const CARD_ASPECT = 5 / 7;

/** Where one card sits in the hand box (px, its unrotated top-left) and how it is turned. */
export interface Slot {
  x: number;
  y: number;
  /** Degrees, about the card's bottom centre: the fan's arc. */
  rotate: number;
  row: number;
}

export interface FanLayout {
  cardW: number;
  cardH: number;
  rows: number;
  /** Horizontal distance between neighbours (the visible sliver of a covered card). */
  step: number;
  /** Room left above the cards for a selected card to rise into. */
  lift: number;
  slots: Slot[];
}

export interface FanOptions {
  aspect?: number;
  /** The widest a card gets (a landscape phone or a tablet). */
  maxCardW?: number;
  /** The narrowest sliver in px: below it a row is added. */
  minStep?: number;
  /** The sliver as a share of the card: room for the corner index ("12"). Cards shrink to keep it. */
  minStepShare?: number;
  /** Cards shrink for the sliver down to this share of the size the height allows; then a row is added. */
  minScale?: number;
  maxRows?: number;
}

/** How far down each later row sits, as a share of the card height (the rows above show their tops). */
export const ROW_DROP = 0.42;
/** How far the fan's ends dip below its middle, as a share of the card height. */
const ARC_DIP = 0.05;

/** How far (degrees) the end cards of a row of `inRow` turn: a wider fan, a wider arc. */
const spreadFor = (inRow: number): number => Math.min(7, inRow * 0.9);

/**
 * How far an end card turned by `deg` about its bottom centre pokes past its unturned box: sideways
 * (its top corner) and down (its bottom corner), as shares of the card's width.
 */
const overhang = (deg: number, aspect: number): { side: number; down: number } => {
  const a = (deg * Math.PI) / 180;
  return { side: Math.sin(a) / aspect - (1 - Math.cos(a)) / 2, down: Math.sin(a) / 2 };
};

/**
 * The fan for `count` cards in a `width` x `height` box. One row while every sliver stays readable
 * (iPhone SE, 343 px of hand: 11 cards in one row); otherwise the fewest rows that keep it readable.
 */
export function fanLayout(
  count: number,
  width: number,
  height: number,
  options: FanOptions = {},
): FanLayout {
  const {
    aspect = CARD_ASPECT,
    maxCardW = 132,
    minStep = 20,
    minStepShare = 0.28,
    minScale = 0.62,
    maxRows = 3,
  } = options;
  const w = Math.max(0, width),
    h = Math.max(0, height);
  const lift = Math.round(Math.min(28, Math.max(10, h * 0.12)));
  let best: FanLayout | null = null;
  let down = 0;
  for (let rows = 1; rows <= maxRows; rows += 1) {
    const perRow = Math.max(1, Math.ceil(count / rows));
    // The turned end cards need room at the sides and below: every corner stays in the box.
    const over = perRow > 1 ? overhang(spreadFor(perRow), aspect) : { side: 0, down: 0 };
    const sides = 1 + 2 * over.side;
    // As big as the height allows, then narrower until every sliver is `minStepShare` of a card.
    const tall = Math.min(
      ((h - lift) / (1 + (rows - 1) * ROW_DROP + ARC_DIP + over.down * aspect)) * aspect,
      maxCardW,
      w * 0.34,
    );
    const fit = perRow > 1 ? w / (sides + minStepShare * (perRow - 1)) : tall;
    const cardW = Math.max(0, Math.min(tall, fit));
    const step = perRow > 1 ? Math.min(cardW * 1.04, (w - cardW * sides) / (perRow - 1)) : 0;
    best = { cardW, cardH: cardW / aspect, rows, step, lift, slots: [] };
    down = over.down * cardW;
    if (perRow <= 1 || (cardW >= tall * minScale && step >= minStep)) break;
  }
  const layout = best!;
  const perRow = Math.max(1, Math.ceil(count / layout.rows));
  // The fan sits at the bottom of its box, under the thumb, whatever height the game gives it.
  const used = layout.lift + layout.cardH * (1 + (layout.rows - 1) * ROW_DROP + ARC_DIP) + down;
  const top = Math.max(0, h - used);
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const k = i - row * perRow;
    const span = layout.cardW + (inRow - 1) * layout.step;
    const centre = (inRow - 1) / 2;
    const t = centre > 0 ? (k - centre) / centre : 0;
    const spread = spreadFor(inRow);
    layout.slots.push({
      x: (w - span) / 2 + k * layout.step,
      y: top + layout.lift + row * ROW_DROP * layout.cardH + t * t * layout.cardH * ARC_DIP,
      rotate: t * spread,
      row,
    });
  }
  return layout;
}

/** The slot nearest a point in the hand box (where a dragged card would go in). */
export function nearestSlot(layout: FanLayout, x: number, y: number): number {
  let best = 0,
    bestD = Infinity;
  layout.slots.forEach((s, i) => {
    const d = (s.x + layout.cardW / 2 - x) ** 2 + (s.y + layout.cardH / 2 - y) ** 2;
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/**
 * The arrangement after the hand changed: kept cards keep their places, new ones join at the end,
 * or, while a sort is on (`sort`, the arrangement untouched by hand since), at their sorted place.
 */
export function reconcileOrder(
  previous: readonly string[],
  cards: readonly SortCard[],
  sort: ((cards: readonly SortCard[]) => readonly string[]) | null = null,
): string[] {
  const ids = new Set(cards.map((c) => c.id));
  if (sort) return [...sort(cards)];
  const kept = previous.filter((id) => ids.has(id));
  const seen = new Set(kept);
  return [...kept, ...cards.filter((c) => !seen.has(c.id)).map((c) => c.id)];
}

/** `moving` (kept in their current order) taken out and put back in at `to` of what is left. */
export function moveIds(order: readonly string[], moving: readonly string[], to: number): string[] {
  const set = new Set(moving);
  const rest = order.filter((id) => !set.has(id));
  const block = order.filter((id) => set.has(id));
  const at = Math.max(0, Math.min(rest.length, to));
  return [...rest.slice(0, at), ...block, ...rest.slice(at)];
}

const suitRank = (suitOrder: readonly string[] | undefined, cards: readonly SortCard[]) => {
  const order = [...(suitOrder ?? [])];
  for (const c of cards) if (!order.includes(c.suit)) order.push(c.suit);
  return (suit: string): number => order.indexOf(suit);
};

/** The ids in a sort's order. Ties keep the hand's current order (a stable sort). */
export function sortIds(
  cards: readonly SortCard[],
  sort: HandSort,
  suitOrder?: readonly string[],
): string[] {
  if (typeof sort === 'object') return [...sort.order(cards)];
  const suit = suitRank(suitOrder, cards);
  const count = new Map<number, number>();
  for (const c of cards) count.set(c.rank, (count.get(c.rank) ?? 0) + 1);
  const by: Record<'rank' | 'suit' | 'sets', (a: SortCard, b: SortCard) => number> = {
    rank: (a, b) => a.rank - b.rank || suit(a.suit) - suit(b.suit),
    suit: (a, b) => suit(a.suit) - suit(b.suit) || a.rank - b.rank,
    // Equal numbers together, the biggest group first: a set to lay reads at a glance.
    sets: (a, b) =>
      (count.get(b.rank) ?? 0) - (count.get(a.rank) ?? 0) ||
      a.rank - b.rank ||
      suit(a.suit) - suit(b.suit),
  };
  return [...cards].sort(by[sort]).map((c) => c.id);
}

export interface TargetRect {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How near (px) a dragged card must come to a target for the target to pull it in. */
export const MAGNET_PX = 28;

/** The target a point is over or within `magnet` px of; the nearest centre wins a tie. */
export function nearestTarget(
  targets: readonly TargetRect[],
  x: number,
  y: number,
  magnet = MAGNET_PX,
): string | null {
  let best: string | null = null,
    bestD = Infinity;
  for (const t of targets) {
    const inside =
      x >= t.left - magnet &&
      x <= t.left + t.width + magnet &&
      y >= t.top - magnet &&
      y <= t.top + t.height + magnet;
    if (!inside) continue;
    const d = (t.left + t.width / 2 - x) ** 2 + (t.top + t.height / 2 - y) ** 2;
    if (d < bestD) {
      best = t.id;
      bestD = d;
    }
  }
  return best;
}
