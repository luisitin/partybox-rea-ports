// T-0173: a count-up shows only numbers the score can be — Bingo's split pot of 0.5 read 1 on the
// TV's scoreboard (every frame was rounded to a whole number) while the phone's chip said 0.5.
import { describe, expect, it } from 'vitest';
import { countUpValue } from './motion';

const frames = (from: number, target: number): number[] =>
  Array.from({ length: 61 }, (_, i) => countUpValue(from, target, i / 60));

describe('countUpValue', () => {
  it('lands a half on the half, never on the next whole number', () => {
    const shown = frames(0, 0.5);
    expect(shown.at(-1)).toBe(0.5);
    expect(new Set(shown)).toEqual(new Set([0, 0.5]));
    expect(frames(10, 12.5).every((n) => Number.isInteger(n * 2))).toBe(true);
    expect(frames(2.5, 4).at(-1)).toBe(4);
  });

  it('keeps whole scores whole and ends exactly on the target', () => {
    const shown = frames(3, 17);
    expect(shown.every(Number.isInteger)).toBe(true);
    expect(shown[0]).toBe(3);
    expect(shown.at(-1)).toBe(17);
    expect(frames(20, 5).at(-1)).toBe(5); // counting down
  });

  it('counts tenths without float noise, and odd decimals still end on the target', () => {
    expect(frames(0.1, 0.3).every((n) => String(n).length <= 3)).toBe(true);
    expect(frames(0, 0.3).at(-1)).toBe(0.3);
    expect(frames(0, 1 / 3).at(-1)).toBe(1 / 3);
    expect(
      frames(0, 1 / 3)
        .slice(0, -1)
        .every((n) => String(n).length <= 5),
    ).toBe(true);
  });
});
