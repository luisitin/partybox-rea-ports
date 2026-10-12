import { describe, expect, it } from 'vitest';
import { clockText, ranked } from './presentation';
import type { RacerView } from '../server/types';

describe('race presentation', () => {
  it('rounds clock seconds up and never shows negative time', () => {
    expect(clockText(180000)).toBe('3:00');
    expect(clockText(60001)).toBe('1:01');
    expect(clockText(1)).toBe('0:01');
    expect(clockText(-1)).toBe('0:00');
  });

  it('uses authoritative ranks and preserves tied order without mutating the view', () => {
    const racers = [
      { id: 'score-leader', rank: 2, score: 2000 },
      { id: 'first-finisher', rank: 1, score: 1900 },
      { id: 'tied-racer', rank: 2, score: 2000 },
    ] as RacerView[];
    const before = [...racers];
    expect(ranked(racers).map((r) => r.id)).toEqual([
      'first-finisher',
      'score-leader',
      'tied-racer',
    ]);
    expect(racers).toEqual(before);
  });
});
