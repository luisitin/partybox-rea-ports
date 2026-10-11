// Curve Fever's shared client helpers as pure functions (no React: __tests__/screens.test.ts pins them).

/** A player's worm colour, by the slot the worm has in the round (the same on the TV and on the phone). */
export const HUES = [8, 210, 135, 48, 285, 172, 24, 330] as const;
export const hueOf = (slot: number): number =>
  HUES[((slot % HUES.length) + HUES.length) % HUES.length] ?? 0;

/** The round clock as m:ss: the time left in whole seconds, rounded up, never below zero. */
export function clockText(msLeft: number): string {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Seconds on the get-ready countdown: 3, 2, 1 (never below 1 while it runs). */
export const countdown = (msLeft: number): number => Math.max(1, Math.ceil(msLeft / 1000));

/** The steering direction two held buttons mean: right minus left (both held cancel). */
export const dirOf = (left: boolean, right: boolean): -1 | 0 | 1 =>
  right === left ? 0 : right ? 1 : -1;
