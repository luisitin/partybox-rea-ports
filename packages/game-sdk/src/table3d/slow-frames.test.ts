import { describe, expect, it } from 'vitest';
import { SLOW_WINDOW, newSlowWatch, watchFrame } from './slow-frames';

/** Run `windows` full windows at a steady frame time; returns how many frames said "slow". */
function run(w: ReturnType<typeof newSlowWatch>, delta: number, windows: number): number {
  let said = 0;
  for (let i = 0; i < windows * SLOW_WINDOW; i++) if (watchFrame(w, delta)) said++;
  return said;
}

describe('watchFrame', () => {
  it('stays quiet while frames are on budget', () => {
    expect(run(newSlowWatch(), 1 / 60, 20)).toBe(0);
  });

  it('says so after three slow windows in a row, then starts over', () => {
    const w = newSlowWatch();
    expect(run(w, 1 / 25, 2)).toBe(0);
    expect(run(w, 1 / 25, 1)).toBe(1);
    expect(run(w, 1 / 25, 2)).toBe(0);
    expect(run(w, 1 / 25, 1)).toBe(1);
  });

  it('a window that runs on budget (or only middling) resets the run', () => {
    const w = newSlowWatch();
    run(w, 1 / 25, 2);
    run(w, 1 / 60, 1);
    expect(run(w, 1 / 25, 2)).toBe(0);
    run(w, 1 / 45, 1);
    expect(run(w, 1 / 25, 2)).toBe(0);
    expect(run(w, 1 / 25, 1)).toBe(1);
  });

  it('a steady 30 fps cadence is slow: the scene can only give up effects, there is no resolution to trade', () => {
    expect(run(newSlowWatch(), 1 / 30, 3)).toBe(1);
  });

  it('counts one long pause as 100 ms, not as a slow window', () => {
    const w = newSlowWatch();
    for (let i = 0; i < 3; i++) {
      for (let f = 0; f < SLOW_WINDOW - 1; f++) watchFrame(w, 1 / 60);
      expect(watchFrame(w, 30)).toBe(false);
    }
  });
});
