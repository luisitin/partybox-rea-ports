import { describe, expect, it } from 'vitest';
import { nextSeen, startSeen } from './phaseSeen';

describe('the phase instance a countdown shows (T-0701 F1, F4)', () => {
  it('a new phase id starts a fresh instance at this moment', () => {
    const a = startSeen('ask', 0, 20_000, false, 0);
    const b = nextSeen(a, 'reveal', 9_000, 25_000, false, 9_000);
    expect(b.gen).toBe(a.gen + 1);
    expect(b.at).toBe(9_000);
  });

  it('a repeated phase id whose deadline moves with no pause is a new instance (bingo calls)', () => {
    const a = startSeen('call', 0, 6_000, false, 0);
    const b = nextSeen(a, 'call', 6_000, 12_000, false, 6_000);
    expect(b.gen).toBe(a.gen + 1);
    expect(b.at).toBe(6_000);
  });

  it('a new instance with the same deadline still restarts the bar', () => {
    const a = startSeen('vote', 0, 20_000, false, 0);
    const b = nextSeen(a, 'vote', 10_000, 20_000, false, 10_000);
    expect(b.gen).toBe(a.gen + 1);
    expect(b.at).toBe(10_000);
  });

  it('a resume moves the start by the same delta, so the fill and the phase length hold', () => {
    // Paused at 5 s with 15 s left of a 20 s phase that started at 0: the bar reads 0.75 and holds.
    const a = startSeen('vote', 0, 20_000, false, 0);
    const paused = nextSeen(a, 'vote', 0, 20_000, true, 5_000);
    // Resumed at 35 s: the server moved the deadline by the 30 s pause and left the instance alone.
    const resumed = nextSeen(paused, 'vote', 0, 50_000, false, 35_000);
    expect(resumed.gen).toBe(a.gen);
    expect(resumed.at).toBe(30_000);
    expect(50_000 - resumed.at).toBe(20_000);
    expect((50_000 - 35_000) / (50_000 - resumed.at)).toBeCloseTo((20_000 - 5_000) / 20_000);
  });

  it('a skip while paused into a same-id phase is a new instance: full, and 5 s long (T-0701 F4)', () => {
    // A 20 s phase that started at 0 is paused at 5 s; at 40 s the VIP skips into a 5 s phase, same id.
    const a = startSeen('vote', 0, 20_000, false, 0);
    const paused = nextSeen(a, 'vote', 0, 20_000, true, 5_000);
    const next = nextSeen(paused, 'vote', 40_000, 45_000, false, 40_000);
    expect(next.gen).toBe(a.gen + 1);
    expect(next.at).toBe(40_000);
    expect((45_000 - 40_000) / (45_000 - next.at)).toBe(1);
    expect(Math.ceil((45_000 - next.at) / 1000)).toBe(5);
  });

  it('a pause alone keeps the same object, so the component does not loop', () => {
    const a = startSeen('vote', 0, 20_000, false, 0);
    expect(nextSeen(a, 'vote', 0, 20_000, false, 100)).toBe(a);
    const p = nextSeen(a, 'vote', 0, 20_000, true, 100);
    expect(p).toMatchObject({ paused: true, at: 0, gen: a.gen });
    expect(nextSeen(p, 'vote', 0, 20_000, true, 200)).toBe(p);
  });

  it('a beat skipped into while paused starts a fresh, full, 4 s instance (ADR-101, T-0779 F6)', () => {
    // A 20 s phase from 0, paused at 5 s; the skip at 40 s moved it to a 4 s beat, named by its time.
    const a = startSeen('reveal', 0, 20_000, false, 0);
    const paused = nextSeen(a, 'reveal', 0, 20_000, true, 5_000);
    const beat = nextSeen(paused, 'reveal', 40_000, 44_000, false, 40_000);
    expect(beat.gen).toBe(a.gen + 1);
    expect(beat.at).toBe(40_000);
    expect(Math.ceil((44_000 - beat.at) / 1000)).toBe(4);
  });
});
