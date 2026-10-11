// BidPad's arithmetic, kept pure so it is tested without a DOM: a bid is a whole number from `min`
// (0 unless a game sets a floor, e.g. an ante) to the coins you have; steppers move by `step`; a chip
// adds its amount; All in is everything.

/** Clamps any number to a legal bid: an integer from `min` to `max` (`max` wins if they cross). */
export function clampBid(value: number, max: number, min = 0): number {
  const top = Math.max(0, Math.floor(max));
  const floor = Math.min(top, Math.max(0, Math.ceil(min)));
  if (!Number.isFinite(value)) return floor;
  return Math.min(top, Math.max(floor, Math.round(value)));
}

/** One stepper press: up or down by `step`, snapping to the step grid first ("37" + 5 → 40). */
export function stepBid(value: number, dir: 1 | -1, step: number, max: number, min = 0): number {
  const s = Math.max(1, Math.round(step));
  const snapped = dir > 0 ? Math.floor(value / s) * s + s : Math.ceil(value / s) * s - s;
  return clampBid(snapped, max, min);
}

/** A quick chip: adds `amount`, never past `max`. */
export function addBid(value: number, amount: number, max: number, min = 0): number {
  return clampBid(value + amount, max, min);
}

/** What each chip would make the bid, and whether it changes anything (a chip at the top is inert). */
export function chipTargets(
  value: number,
  chips: readonly number[],
  max: number,
  min = 0,
): { amount: number; to: number; live: boolean }[] {
  return chips.map((amount) => {
    const to = addBid(value, amount, max, min);
    return { amount, to, live: to !== value };
  });
}
