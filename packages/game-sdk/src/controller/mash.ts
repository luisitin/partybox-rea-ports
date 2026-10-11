// T-0225: when a tap on a PrimaryButton is part of a mash. Keyed on time, not `event.detail`:
// WebKit reports detail 1 for every tap, so an iPhone's triple tap looks like three presses.

/** Taps closer than this are one press (a human double-tap is 100–250 ms apart). */
export const MASH_MS = 500;

export interface MashClock {
  /** The last tap on any PrimaryButton on this page (the burst so far). */
  anyTap: number;
}

/**
 * A tap at `now` on a button shown at `shownAt` that last took a tap at `ownTap` is a mash when
 * it follows its own last tap inside MASH_MS, or when the button appeared after the burst's last
 * tap and this tap is still inside MASH_MS of it (the burst began on the screen before). Every
 * tap, kept or dropped, extends the burst.
 */
export function isMash(clock: MashClock, now: number, shownAt: number, ownTap: number): boolean {
  const prev = clock.anyTap;
  clock.anyTap = now;
  if (now - ownTap < MASH_MS) return true;
  return shownAt >= prev && now - prev < MASH_MS;
}

/** One page, one burst: shared by every PrimaryButton (the client has one page per tab). */
export const PAGE_MASH_CLOCK: MashClock = { anyTap: -Infinity };
