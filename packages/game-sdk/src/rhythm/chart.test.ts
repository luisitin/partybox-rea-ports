import { describe, expect, it } from 'vitest';
import { seedRng } from '@partybox/shared';
import {
  OK_MS,
  PERFECT_MS,
  buildChart,
  freshMarks,
  judgeTap,
  maxPoints,
  pointsOf,
  settleMarks,
} from './chart';
import type { RhythmStyle } from './chart';

const steady: RhythmStyle = {
  shape: 'steady',
  lanes: 1,
  beatMs: [700, 600, 500],
  kinds: [
    { weight: 3, beats: 1 },
    { weight: 1, beats: 2 },
  ],
  rest: 10,
};
const pairs: RhythmStyle = { ...steady, shape: 'pairs', lanes: 2 };
const groups: RhythmStyle = { ...steady, shape: 'groups' };
const cues: RhythmStyle = { ...steady, shape: 'cues' };

const chartOf = (style: RhythmStyle, seats = 4, seed = 7) =>
  buildChart(seedRng(seed), style, seats, 45_000)[0];

describe('buildChart', () => {
  it('is a pure function of the seed', () => {
    expect(chartOf(steady)).toEqual(chartOf(steady));
    expect(chartOf(steady, 4, 8)).not.toEqual(chartOf(steady, 4, 7));
  });

  it('keeps every note inside the song, in order', () => {
    for (const style of [steady, pairs, groups, cues]) {
      const { notes } = chartOf(style);
      expect(notes.length).toBeGreaterThan(10);
      expect(notes.every((n) => n.t >= 0 && n.t < 45_000)).toBe(true);
      expect(notes.map((n) => n.t)).toEqual([...notes.map((n) => n.t)].sort((a, b) => a - b));
    }
  });

  it('pairs need their pickup; groups are scenery then one push; cues name seats', () => {
    const p = chartOf(pairs).notes;
    expect(p[1]).toMatchObject({ lane: 1, need: 0 });
    const g = chartOf(groups).notes;
    expect(g.slice(0, 3).every((n) => n.lane === -1)).toBe(true);
    expect(g[3]?.lane).toBe(0);
    const c = chartOf(cues, 4).notes;
    expect(c.every((n) => (n.who?.length ?? 0) > 0)).toBe(true);
  });
});

describe('marks and judging', () => {
  const chart = chartOf(steady);
  const note = chart.notes[0]!;

  it('judges perfect, early, late and nothing', () => {
    const fresh = freshMarks(chart, 0);
    expect(judgeTap(chart, fresh, 0, note.t + PERFECT_MS).marks[0]).toBe('p');
    expect(judgeTap(chart, fresh, 0, note.t - PERFECT_MS - 10).marks[0]).toBe('e');
    expect(judgeTap(chart, fresh, 0, note.t + OK_MS).marks[0]).toBe('l');
    expect(judgeTap(chart, fresh, 0, note.t + OK_MS + 1).hit).toBeNull();
    expect(judgeTap(chart, fresh, 1, note.t).hit).toBeNull();
  });

  it('answers a note only once', () => {
    const once = judgeTap(chart, freshMarks(chart, 0), 0, note.t).marks;
    expect(judgeTap(chart, once, 0, note.t).hit).toBeNull();
  });

  it('settles old notes as misses, and a pair without its pickup is dry', () => {
    const fresh = freshMarks(chart, 0);
    expect(settleMarks(chart, fresh, note.t + OK_MS + 1)[0]).toBe('x');
    expect(settleMarks(chart, fresh, note.t + OK_MS)[0]).toBe('.');
    const pair = chartOf(pairs);
    const second = pair.notes[1]!;
    const dry = judgeTap(pair, freshMarks(pair, 0), 1, second.t);
    expect(dry.marks[1]).toBe('d');
    const picked = judgeTap(pair, freshMarks(pair, 0), 0, pair.notes[0]!.t).marks;
    expect(judgeTap(pair, picked, 1, second.t).marks[1]).toBe('p');
  });

  it('counts 2 for perfect, 1 for early or late, and leaves scenery and other seats out', () => {
    expect(pointsOf('pel x d.')).toBe(4);
    expect(maxPoints('p-.x')).toBe(6);
    const c = chartOf(cues, 4);
    const total = [0, 1, 2, 3].map((s) => freshMarks(c, s).replaceAll('-', '').length);
    expect(Math.max(...total)).toBeLessThanOrEqual(c.notes.length);
    expect(freshMarks(chartOf(groups), 0).startsWith('---.')).toBe(true);
  });
});
