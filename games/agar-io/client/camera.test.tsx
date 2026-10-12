// Camera projection and rendered identity regressions, independent of server reducers.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Cell } from '../server/types';
import { Arena } from './Arena';
import { CAMERA_UNITS, cameraTransform, cellName, cellNameSize, playerCamera } from './camera';

const cell = (patch: Partial<Cell> = {}): Cell => ({
  id: 1,
  owner: 'p1',
  x: 80,
  y: 50,
  mass: 24,
  vx: 0,
  vy: 0,
  mergeAt: 0,
  shieldUntil: 0,
  ...patch,
});
const viewport = { width: 390, height: 500 };

describe('classic player camera', () => {
  it('places the arithmetic mean of owned pieces at the viewport centre, regardless of mass or rivals', () => {
    const cells = [
      cell({ x: 30, y: 20 }),
      cell({ id: 2, x: 70, y: 60, mass: 400 }),
      cell({ id: 3, owner: 'p2', x: 150, y: 90, mass: 1000 }),
    ];
    const before = structuredClone(cells);
    const camera = playerCamera(cells, 'p1', viewport)!;
    expect(camera.x).toBe(50);
    expect(camera.y).toBe(40);
    const matrix = cameraTransform(camera).slice(7, -1).split(',').map(Number);
    expect(camera.x * matrix[0]! + matrix[4]!).toBeCloseTo(195);
    expect(camera.y * matrix[3]! + matrix[5]!).toBeCloseTo(250);
    expect(cells).toEqual(before);
  });

  it('uses the classic quarter-power growth zoom and the 965px viewport baseline', () => {
    const small = playerCamera([cell({ mass: 100 })], 'p1', viewport)!;
    const grown = playerCamera([cell({ mass: 400 })], 'p1', viewport)!;
    expect(small.zoom).toBeCloseTo((64 / 100) ** 0.25 * (500 / 965) * (10 / 0.55));
    expect(grown.zoom / small.zoom).toBeCloseTo(2 ** -0.25);
    expect(grown.zoom).toBeLessThan(small.zoom);
  });

  it('includes every split radius and follows the pieces without moving their server positions', () => {
    const intact = playerCamera([cell({ mass: 200 })], 'p1', viewport)!;
    const pieces = [cell({ x: 60, mass: 100 }), cell({ id: 2, x: 100, mass: 100 })];
    const split = playerCamera(pieces, 'p1', viewport)!;
    expect(split.x).toBe(80);
    expect(split.zoom / intact.zoom).toBeCloseTo(Math.sqrt(2) ** -0.25);
    expect(pieces.map((piece) => piece.x)).toEqual([60, 100]);
  });

  it('preserves original viewport proportions and caps only the no-growth factor', () => {
    const portrait = playerCamera([cell()], 'p1', { width: 390, height: 965 })!;
    const landscape = playerCamera([cell()], 'p1', { width: 1920, height: 500 })!;
    expect(portrait.zoom).toBeCloseTo(CAMERA_UNITS);
    expect(landscape.zoom).toBeCloseTo(CAMERA_UNITS);
    const resized = playerCamera([cell()], 'p1', { width: 780, height: 1930 })!;
    expect(resized.zoom / portrait.zoom).toBeCloseTo(2);
  });

  it('falls back to an overview when no player pose exists, including spectators and swallowed refreshes', () => {
    expect(playerCamera([cell()], undefined, viewport)).toBeNull();
    expect(playerCamera([cell()], 'spectator', viewport)).toBeNull();
    expect(playerCamera([], 'p1', viewport)).toBeNull();
    const collapsed = playerCamera([cell()], 'p1', { width: 0, height: 0 })!;
    expect(collapsed.width).toBe(1);
    expect(collapsed.height).toBe(1);
    expect(Number.isFinite(collapsed.zoom)).toBe(true);
  });
});

describe('inside cell identity', () => {
  it('draws each body and name together in radius/id order so bigger cells naturally occlude smaller ones', () => {
    const cells = [cell({ id: 3, mass: 200 }), cell({ id: 2 }), cell({ id: 1 })];
    const html = renderToStaticMarkup(
      <Arena
        cells={cells}
        pellets={[]}
        players={[{ id: 'p1', name: 'Ana', avatarId: 'fox', connected: true, status: 'active' }]}
        slots={{ p1: 0 }}
        checked={0}
      />,
    );
    const groups = [...html.matchAll(/<g[^>]*data-cell-id="(\d+)"[^>]*>([\s\S]*?)<\/g>/g)];
    expect(groups.map((group) => Number(group[1]))).toEqual([1, 2, 3]);
    for (const group of groups) {
      expect(group[2]).toContain(`data-cell-label-id="${group[1]}"`);
      expect(group[2]!.indexOf('data-cell-body=')).toBeLessThan(
        group[2]!.indexOf('data-name-owner='),
      );
    }
  });
  it('uses the classic name-size minimum and preserves distinguishing final characters in long names', () => {
    expect(cellNameSize(2.694438717)).toBeCloseTo(22 / CAMERA_UNITS);
    expect(cellName('Ana', 2.7)).toBe('Ana');
    expect(cellName('WWWWWWWWWWWWWWW1', 2.7)).toMatch(/^W+…1$/);
    expect(cellName('WWWWWWWWWWWWWWW2', 2.7)).toMatch(/^W+…2$/);
    expect(cellName('😀😀😀😀😀😀😀😀8', 2.7)).not.toMatch(/[\uD800-\uDBFF]…/);
  });

  it('renders each split name at its true pose, preserves full accessible names and uses round food', () => {
    const cells = [cell(), cell({ id: 2, x: 85, mass: 12 })];
    const html = renderToStaticMarkup(
      <Arena
        cells={cells}
        pellets={[{ id: 1, x: 30, y: 20 }]}
        players={[
          { id: 'p1', name: 'Ana <&>', avatarId: 'fox', connected: true, status: 'active' },
        ]}
        slots={{ p1: 0 }}
        checked={0}
        mine="p1"
        follow
        phone
      />,
    );
    expect(html).toContain('data-camera="personal"');
    expect(html).toContain('data-camera-center="82.5 50"');
    expect(html).toContain('data-camera-clipping="intentional player viewport"');
    expect(html.match(/data-name-owner="p1"/g) ?? []).toHaveLength(2);
    expect(html.match(/data-name-inside="true"/g) ?? []).toHaveLength(2);
    expect(html).toContain('Ana &lt;&amp;&gt;, blob 1');
    expect(html).toMatch(/<circle[^>]*data-snack-id="1"/);
    expect(html).not.toContain('data-cell-label-backplate');
    expect(html).not.toContain('data-number-leader');
    expect(html).not.toMatch(/<path[^>]*d="[^"]*Q/);
  });
});
