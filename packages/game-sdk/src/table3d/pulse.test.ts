import { describe, expect, it } from 'vitest';
import { pulseWave } from './pulse';

describe('pulseWave', () => {
  it('swells from the middle to the top, back through the middle to the bottom, and around', () => {
    expect(pulseWave(0, 1.6, false)).toBeCloseTo(0.5);
    expect(pulseWave(0.4, 1.6, false)).toBeCloseTo(1);
    expect(pulseWave(0.8, 1.6, false)).toBeCloseTo(0.5);
    expect(pulseWave(1.2, 1.6, false)).toBeCloseTo(0);
    expect(pulseWave(1.6, 1.6, false)).toBeCloseTo(0.5);
  });
  it('holds at the middle when still, whatever the time', () => {
    for (const seconds of [0, 0.4, 1.2, 37.9]) expect(pulseWave(seconds, 1.6, true)).toBe(0.5);
  });
});
