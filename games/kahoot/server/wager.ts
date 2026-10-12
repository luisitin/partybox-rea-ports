// I-752 A: the wager arithmetic, with no content import, so the phone can use it without
// downloading the question bank (scoring.ts imports content; the phone must not).

/** `percent` of `score`, rounded down to a multiple of 10; never negative. All in is the whole
 *  score — "4610 of your 4611" read as a rounding slip (review-loop #52). */
export function wagerAmount(score: number, percent: number): number {
  if (score <= 0) return 0;
  if (percent >= 100) return score;
  return Math.floor((score * percent) / 100 / 10) * 10;
}

/** I-026: a custom stake in points — never above the score, rounded down to tens like a preset
 *  (the whole score is allowed, as "all in" is). */
export function clampWager(score: number, amount: number): number {
  if (score <= 0 || amount <= 0) return 0;
  if (amount >= score) return score;
  return Math.floor(amount / 10) * 10;
}
