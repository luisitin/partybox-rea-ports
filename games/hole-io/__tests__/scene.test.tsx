import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { City } from '../client/City';
import {
  cameraFor,
  clipGround,
  inFrame,
  MODEL_HEIGHT,
  objectFaces,
  project,
} from '../client/scene';
import { game } from '../server/index';
import type { CityView, PropKind } from '../server/types';

function city(): CityView {
  return game.tvView(
    game.init({
      now: 1000,
      seed: 8,
      settings: {},
      players: [
        { id: 'a', name: 'Aria', avatarId: 'fox', connected: true },
        { id: 'b', name: 'Basil', avatarId: 'owl', connected: true },
      ],
    }),
  ).city;
}

describe('player-following 3D city', () => {
  it('tracks the owner at a local zoom and retains that identity after crossing a district', () => {
    const view = city(),
      before = JSON.stringify(view);
    const first = cameraFor(view, 'a', false);
    const moved = {
      ...view,
      holes: view.holes.map((h) => (h.id === 'a' ? { ...h, x: 130, y: 85 } : h)),
    };
    const next = cameraFor(moved, 'a', false);
    expect(next.target).toBe('a');
    expect(next.x).toBe(130);
    expect(next.y).toBe(85);
    expect(next.scale).toBe(first.scale);
    expect(640 / next.scale).toBeLessThan(90);
    expect(project({ x: 130, y: 85, z: 0 }, next)).toEqual({ x: 320, y: 360 * 0.62 });
    expect(JSON.stringify(view)).toBe(before);
    expect(inFrame(0, 0, 1, 2, next)).toBe(false);
  });
  it('switches an eliminated viewer to a live leader and uses stable tied-score slots', () => {
    const view = city();
    view.holes[0] = { ...view.holes[0]!, alive: false, score: 999 };
    view.holes[1] = { ...view.holes[1]!, score: 10 };
    expect(cameraFor(view, 'a', true).target).toBe('b');
    expect(cameraFor(view, undefined, true).target).toBe('b');
    expect(cameraFor(view, 'a', true).height).toBe(480);
    view.holes[0] = { ...view.holes[0]!, alive: true, score: 10 };
    expect(cameraFor(view, undefined, false).target).toBe('a');
  });
  it('projects roofs above walls with perspective, rather than painting flat map icons', () => {
    const camera = cameraFor(city(), 'a', false);
    const foot = project({ x: camera.x + 2, y: camera.y, z: 0 }, camera);
    const roof = project({ x: camera.x + 2, y: camera.y, z: 10 }, camera);
    expect(roof.y).toBeLessThan(foot.y);
    expect(roof.x).toBeGreaterThan(foot.x);
    const far = project({ x: camera.x + 5, y: camera.y - 20, z: 0 }, camera);
    const near = project({ x: camera.x + 5, y: camera.y + 20, z: 0 }, camera);
    expect(near.y - camera.height * 0.62).toBeGreaterThan(camera.height * 0.62 - far.y);
  });
  it('clips tilted meshes at the ground while retaining their partially submerged upper faces', () => {
    const cross = clipGround([
      { x: 0, y: 0, z: -2 },
      { x: 2, y: 0, z: 2 },
      { x: 2, y: 2, z: 2 },
      { x: 0, y: 2, z: -2 },
    ]);
    expect(cross).toHaveLength(4);
    expect(cross.every((p) => p.z >= 0)).toBe(true);
    expect(cross.filter((p) => p.z === 0).map((p) => p.x)).toEqual([1, 1]);
    for (const kind of Object.keys(MODEL_HEIGHT) as PropKind[]) {
      const full = objectFaces(kind, 0, 0),
        partial = objectFaces(kind, 0, 0, 0.3, MODEL_HEIGHT[kind] / 2);
      expect(full.some((f) => f.points.some((p) => p.z > 0))).toBe(true);
      expect(partial.length).toBeGreaterThan(0);
      expect(partial.length).toBeLessThanOrEqual(full.length);
      expect(partial.every((f) => f.points.every((p) => Number.isFinite(p.z) && p.z >= 0))).toBe(
        true,
      );
      expect(objectFaces(kind, 0, 0, 0.78, MODEL_HEIGHT[kind] + 10)).toEqual([]);
    }
  });
  it('renders local models and native attached owner names, suppressing coincident rival names', () => {
    const view = city(),
      owner = view.holes[0]!;
    view.holes[1] = { ...view.holes[1]!, x: owner.x, y: owner.y };
    const html = renderToStaticMarkup(
      <City
        city={view}
        mine="a"
        players={[
          { id: 'a', name: 'Aria' },
          { id: 'b', name: 'Basil' },
        ]}
      />,
    );
    expect(html).toContain('data-camera="a"');
    expect(html).toContain('data-mesh="3d"');
    expect(html).toContain('1 · Aria');
    expect(html).not.toContain('2 · Basil');
    expect(html).not.toContain('viewBox="0 0 180 110"');
  });
});
