import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { clockText, raceTime, runnerMetres, slotStyle, standingsRows } from './display';

const players = [
  { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
  { id: 'b', name: 'Ben', avatarId: 'owl', connected: true },
  { id: 'c', name: 'Cam', avatarId: 'cat', connected: true },
];
const view = game.tvView(game.init({ players, settings: {}, seed: 13, now: 1000 }));

describe('authoritative drawing and rankings', () => {
  it('never draws more than one tick ahead or rewinds checked state', () => {
    const live = { ...view, checked: 1200 };
    expect(raceTime(live, 900, true)).toBe(1200);
    expect(raceTime(live, 2250, true)).toBe(1250);
    expect(raceTime(live, 999999, true)).toBe(1300);
    expect(raceTime(live, 999999, false)).toBe(1200);
  });

  it('uses actual metres for a dead runner, regardless of later projected time', () => {
    const runner = { ...view.runners[0]!, died: 200, distance: 72 };
    expect(runnerMetres(runner, 60000)).toBe(7);
  });

  it('ranks ties equally and retains identity slot order', () => {
    const rows = standingsRows({
      ...view,
      scores: { a: 100, b: 100, c: 20 },
      lastPoints: { a: 50 },
    });
    expect(rows.map((row) => [row.name, row.rank, row.tied, row.slot])).toEqual([
      ['Ana', 1, true, 0],
      ['Ben', 1, true, 1],
      ['Cam', 3, false, 2],
    ]);
    expect(rows[0]?.gained).toBe(50);
  });

  it('formats remaining time and selects only design-system player tokens', () => {
    expect(clockText(60000)).toBe('1:00');
    expect(clockText(1)).toBe('0:01');
    expect(clockText(-1)).toBe('0:00');
    expect(slotStyle(7)).toEqual({ '--pb-runner': 'var(--pb-player-8)' });
    expect(slotStyle(-1)).toEqual({ '--pb-runner': 'var(--pb-player-1)' });
  });
});
