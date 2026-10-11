// A string order that is the same on every machine (FOUNDATION-AUDIT #30, ADR-048).
// `localeCompare` follows the host's ICU data and locale, so two hosts could break a tie
// differently and a replay would drift. Game servers and the pure SDK helpers sort ids with this;
// for the ids the engine mints (lowercase UUIDs, `p1`…`p16` in tests) it gives the same order
// `localeCompare` gave.

/** Compares UTF-16 code units: negative when `a` sorts first, 0 when equal. For `Array#sort`. */
export function compareCodeUnits(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
