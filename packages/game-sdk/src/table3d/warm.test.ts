import { describe, expect, it } from 'vitest';
import { CALM, WARM, WARM_CAP, newWarm, warmFrame } from './warm';

/** Frames at `step` seconds from `from` until the answer is yes or `until`; returns the time of the yes (or -1). */
function run(w: ReturnType<typeof newWarm>, from: number, until: number, step: number): number {
  for (let t = from; t <= until; t += step) if (warmFrame(w, t, step)) return t;
  return -1;
}

describe('warmFrame', () => {
  it('waits the warm-up on a smooth machine, then says yes', () => {
    const at = run(newWarm(), 10, 30, 1 / 60);
    expect(at).toBeGreaterThanOrEqual(10 + WARM);
    expect(at).toBeLessThan(10 + WARM + 0.1);
  });

  it('a long frame restarts the quiet', () => {
    const w = newWarm();
    expect(run(w, 0, 2.9, 1 / 60)).toBe(-1);
    expect(warmFrame(w, 3, 1.4)).toBe(false); // the hitch
    expect(run(w, 3.02, 3 + CALM - 0.1, 1 / 60)).toBe(-1);
    expect(run(w, 3 + CALM - 0.05, 9, 1 / 60)).toBeGreaterThanOrEqual(3 + CALM);
  });

  it('gives up waiting after the cap, hitches or not', () => {
    const w = newWarm();
    run(w, 0, 0.4, 1 / 60); // a smooth start, so it is not the slow-machine shortcut
    let said = -1;
    for (let t = 0.5; t < 20 && said < 0; t += 0.1) if (warmFrame(w, t, 0.06)) said = t;
    expect(said).toBeGreaterThanOrEqual(WARM_CAP);
    expect(said).toBeLessThan(WARM_CAP + 0.2);
  });

  it('a machine that never ran smooth (software GL) is ready after the sample', () => {
    const w = newWarm();
    let frames = 0;
    for (let t = 0; t < 5; t += 0.06) {
      frames++;
      if (warmFrame(w, t, 0.06)) break;
    }
    expect(frames).toBe(20);
  });
});
