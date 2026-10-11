// T-0225: one press per mash, keyed on time (WebKit reports detail 1 for every tap).
import { describe, expect, it } from 'vitest';
import { isMash, MASH_MS } from './mash';

const fresh = (): { anyTap: number } => ({ anyTap: -Infinity });

describe('isMash', () => {
  it('drops a second tap on one button at 300 ms and takes one at 600 ms', () => {
    const clock = fresh();
    expect(isMash(clock, 1000, 0, -Infinity)).toBe(false);
    expect(isMash(clock, 1300, 0, 1000)).toBe(true);
    const later = fresh();
    expect(isMash(later, 1000, 0, -Infinity)).toBe(false);
    expect(isMash(later, 1000 + MASH_MS + 100, 0, 1000)).toBe(false);
  });

  it('drops a tap on a button shown mid-burst, then takes a deliberate one', () => {
    const clock = fresh();
    expect(isMash(clock, 1000, 0, -Infinity)).toBe(false); // taps "Guess"
    // "Send an empty sheet" mounts at 1100; the burst's 2nd and 3rd taps land on it
    expect(isMash(clock, 1150, 1100, -Infinity)).toBe(true);
    expect(isMash(clock, 1300, 1100, 1150)).toBe(true);
    // a real press, well after the burst ended
    expect(isMash(clock, 2500, 1100, 1300)).toBe(false);
  });

  it('keeps a first tap on a button that was already on screen when the burst began', () => {
    const clock = fresh();
    expect(isMash(clock, 1000, 0, -Infinity)).toBe(false);
    // another button, on screen since 0, tapped 200 ms later: a separate press
    expect(isMash(clock, 1200, 0, -Infinity)).toBe(false);
  });
});
