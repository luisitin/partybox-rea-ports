// Player-visible headings, snake numbers and sizes; independent of React event plumbing.
import { describe, expect, it } from 'vitest';
import type { Snake, World } from '../server/types';
import { standingsRows } from './standingsRows';
import { keyboardHeading, pointerHeading } from './timing';

describe('absolute direction pad', () => {
  it.each([
    [200, 50, 0],
    [100, 100, Math.PI / 2],
    [0, 50, Math.PI],
    [100, 0, -Math.PI / 2],
    [150, 100, Math.PI / 4],
  ])('a rectangular pad maps (%s, %s) to the heading', (x, y, expected) => {
    expect(pointerHeading(x, y, 200, 100)).toBeCloseTo(expected!);
  });

  it('ignores the centre, including a small accidental movement', () => {
    expect(pointerHeading(100, 50, 200, 100)).toBeNull();
    expect(pointerHeading(105, 54, 200, 100)).toBeNull();
    expect(pointerHeading(110, 50, 200, 100)).toBe(0);
  });

  it('retains direction outside a captured pad and always stays in the input range', () => {
    expect(pointerHeading(500, 50, 200, 100)).toBe(0);
    for (let x = -200; x <= 400; x += 20)
      for (let y = -100; y <= 200; y += 20) {
        const heading = pointerHeading(x, y, 200, 100);
        if (heading !== null) {
          expect(heading).toBeGreaterThanOrEqual(-Math.PI);
          expect(heading).toBeLessThanOrEqual(Math.PI);
        }
      }
  });
});

describe('keyboard headings', () => {
  it.each([
    [['right'], 0],
    [['down'], Math.PI / 2],
    [['left'], Math.PI],
    [['up'], -Math.PI / 2],
    [['down', 'right'], Math.PI / 4],
    [['up', 'left'], (-Math.PI * 3) / 4],
    [['left', 'right', 'down'], Math.PI / 2],
  ] as const)('combines %s into one heading', (keys, expected) => {
    expect(keyboardHeading(new Set(keys))).toBeCloseTo(expected);
  });

  it('no keys or cancelling opposite keys keep the previous heading', () => {
    for (const keys of [
      [],
      ['left', 'right'],
      ['up', 'down'],
      ['up', 'down', 'left', 'right'],
      ['other'],
    ])
      expect(keyboardHeading(new Set(keys))).toBeNull();
  });
});

const snake = (id: string, changes: Partial<Snake> = {}): Snake => ({
  id,
  body: [[80, 50]],
  angle: 0,
  target: 0,
  boost: false,
  mass: 14,
  respawnAt: null,
  safeUntil: 0,
  crashes: 0,
  ...changes,
});
const players = [
  { id: 'a', name: 'Ana', connected: true },
  { id: 'b', name: 'Ben', connected: false },
  { id: 'c', name: 'Cam', connected: true },
];

describe('public standings', () => {
  const world: World = {
    elapsed: 1000,
    food: [],
    snakes: [
      snake('b', { mass: 13.9, safeUntil: 1001, boost: true }),
      snake('a', { mass: 8, respawnAt: 2501 }),
      snake('c', { mass: 20.1, safeUntil: 1000 }),
    ],
  };
  const source = { players, world, scores: { a: 10, b: 30, c: 30 }, lastPoints: { a: 8, b: 13 } };

  it('uses arena order for stable numbers, public names, connection and status', () => {
    const rows = standingsRows(source, false);
    expect(rows.map((row) => [row.id, row.slot])).toEqual([
      ['b', 0],
      ['a', 1],
      ['c', 2],
    ]);
    expect(rows[0]).toMatchObject({ name: 'Ben', connected: false, boost: true, protected: true });
    expect(rows[1]).toMatchObject({ name: 'Ana', respawnIn: 2, gained: 8 });
    expect(rows[2]?.protected).toBe(false);
  });

  it('shows the floor of mass, exactly the size the buzzer will bank', () => {
    expect(standingsRows(source, false).map((row) => row.mass)).toEqual([13, 8, 20]);
  });

  it('ranks totals while retaining numbers and deterministic ties; leaves inputs untouched', () => {
    const before = JSON.stringify(source);
    const rows = standingsRows(source, true);
    expect(rows.map((row) => [row.id, row.slot, row.total])).toEqual([
      ['b', 0, 30],
      ['c', 2, 30],
      ['a', 1, 10],
    ]);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('handles a TV-room phone without a world and missing score entries', () => {
    const rows = standingsRows({ players, scores: { b: 5 }, lastPoints: {} }, false);
    expect(rows.map((row) => [row.id, row.slot, row.name, row.total, row.gained])).toEqual([
      ['a', 0, 'Ana', 0, 0],
      ['b', 1, 'Ben', 5, 0],
      ['c', 2, 'Cam', 0, 0],
    ]);
    expect(rows.every((row) => row.respawnIn === 0 && !row.protected && !row.boost)).toBe(true);
  });

  it('renders a snake with no roster match safely and never produces a zero return countdown', () => {
    const rows = standingsRows(
      {
        players: [],
        scores: {},
        lastPoints: {},
        world: { elapsed: 3000, food: [], snakes: [snake('stranger', { respawnAt: 2500 })] },
      },
      false,
    );
    expect(rows[0]).toMatchObject({
      id: 'stranger',
      name: '',
      connected: false,
      respawnIn: 1,
      total: 0,
    });
  });
});
