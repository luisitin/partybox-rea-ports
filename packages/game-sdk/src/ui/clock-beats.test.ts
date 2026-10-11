// Server-clock beats (ABSTRACTION_AUDIT #15): which beat a late-mounting screen lands on.
import { describe, expect, it } from 'vitest';
import { beatAt } from './clock';

describe('beatAt', () => {
  const beats = [0, 300, 900, 1500] as const;

  it('is the latest beat reached, beat 0 from the start', () => {
    expect(beatAt(0, beats)).toBe(0);
    expect(beatAt(299, beats)).toBe(0);
    expect(beatAt(300, beats)).toBe(1);
    expect(beatAt(1499, beats)).toBe(2);
    expect(beatAt(60_000, beats)).toBe(3);
  });

  it('stays on beat 0 before the phase began (a clock a little behind the server)', () => {
    expect(beatAt(-250, beats)).toBe(0);
  });
});
