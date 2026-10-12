// Camera projection and rendered identity regressions, independent of server reducers.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Cell } from '../server/types';
import { Arena } from './Arena';
import {
  CAMERA_FRAME_COUNT,
  CAMERA_MOTION_MS,
  CAMERA_UNITS,
  CameraMotionSession,
  PoseMotionSession,
  cameraFromTransform,
  cameraMotionFrames,
  cameraTransform,
  cellNameSize,
  cellNameBaseline,
  foodPoints,
  ownedCameraPoses,
  outlineMotionFrames,
  nameMotionFrames,
  playerCamera,
} from './camera';
import type { Camera, CameraPose, CameraSurface, PoseSurface } from './camera';

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

describe('painted contact outline lifecycle', () => {
  it('refreshes a stationary body when its neighbour moves, rebases its public contour, and cancels on pause', () => {
    const session = new PoseMotionSession();
    const start: CameraPose[] = [
      { id: 1, x: 10, y: 10, radius: 4, outlinePath: 'M4 0 L0 4 Z' },
      { id: 2, x: 18, y: 10, radius: 4 },
    ];
    const next = [start[0]!, { ...start[1]!, x: 16 }];
    const contours: CameraPose[] = [];
    let cancelled = 0;
    const nothing = () => ({ cancel() {} });
    const surface: PoseSurface = {
      animatePose: nothing,
      animateRadius: nothing,
      animateOutlineRadius: nothing,
      animateNameFont: nothing,
      animateOutlinePath: (_id, from) => {
        contours.push(from);
        return {
          cancel: () => {
            cancelled++;
          },
        };
      },
    };
    session.update(surface, 'phone:p1', [], start, false);
    expect(contours).toHaveLength(0);
    session.update(surface, 'phone:p1', start, next, false);
    expect(contours).toHaveLength(2);
    expect(contours[0]!.outlinePath).toBe('M4 0 L0 4 Z');
    session.update(surface, 'phone:p1', next, next, false);
    expect(contours).toHaveLength(2);
    session.update(surface, 'phone:p1', next, next, true);
    expect(cancelled).toBe(2);
    session.update(surface, 'phone:p2', next, start, false);
    expect(contours).toHaveLength(2);
  });
});

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

describe('classic received camera filtering', () => {
  it('matches independent original-parser captures at frames3/6/9 including prior-radius zoom order', () => {
    const before = [cell()];
    const after = [cell({ x: 84, mass: 96 })];
    const untouched = structuredClone({ before, after });
    const frames = cameraMotionFrames(
      playerCamera(before, 'p1', viewport)!,
      ownedCameraPoses(before, 'p1'),
      ownedCameraPoses(after, 'p1'),
    );
    // jobs/P05-blob-arena/r1-fidelity-before-motion.json: untouched pinned original,
    // one public received +4/4×mass packet and a deterministic60Hz Date.now clock.
    const reference = [
      { frame: 3, x: 80.96189331054688, y: 49.9999984741211, zoom: 9.42063114859841 },
      { frame: 6, x: 83.03287963867189, y: 49.9999984741211, zoom: 9.302779761227693 },
      { frame: 9, x: 83.87747741699219, y: 49.9999984741211, zoom: 9.083687175403941 },
    ];
    for (const sample of reference) {
      const actual = frames[sample.frame]!;
      expect(actual.offset * CAMERA_MOTION_MS).toBeCloseTo((sample.frame * 1000) / 60);
      expect(
        Math.hypot(actual.camera.x - sample.x, actual.camera.y - sample.y) * sample.zoom,
      ).toBeLessThan(0.001);
      expect(actual.camera.zoom).toBeCloseTo(sample.zoom, 5);
    }
    expect(frames).toHaveLength(CAMERA_FRAME_COUNT + 1);
    expect(frames.at(-1)!.camera).toEqual(playerCamera(after, 'p1', viewport));
    expect(
      cameraMotionFrames(
        playerCamera(before, 'p1', viewport)!,
        ownedCameraPoses(before, 'p1').map((pose) => ({
          ...pose,
          outlineRadius: 100,
          fontSize: 20,
        })),
        ownedCameraPoses(after, 'p1'),
      ),
    ).toEqual(frames);
    expect({ before, after }).toEqual(untouched);
  });

  it('begins new split pieces at their received positions and excludes destroyed owned pieces', () => {
    const start = playerCamera([cell()], 'p1', viewport)!;
    const from = ownedCameraPoses([cell(), cell({ id: 99, x: 150 })], 'p1');
    const to = ownedCameraPoses([cell({ mass: 12 }), cell({ id: 2, x: 100, mass: 12 })], 'p1');
    const frames = cameraMotionFrames(start, from, to);
    // The new piece is already at100; old id99 cannot pull the camera toward150.
    expect(frames[1]!.camera.x).toBe(85);
    expect(frames.at(-1)!.camera.x).toBe(90);
    expect(frames.every((frame) => Object.values(frame.camera).every(Number.isFinite))).toBe(true);
    expect(cameraMotionFrames(start, from, [])).toEqual([]);
  });

  it('decodes only a finite positive uniform public camera matrix', () => {
    const camera = playerCamera([cell()], 'p1', viewport)!;
    expect(cameraFromTransform(cameraTransform(camera), viewport)).toEqual(camera);
    expect(cameraFromTransform('none', viewport)).toBeNull();
    expect(cameraFromTransform('matrix(1, 1, 0, 1, 0, 0)', viewport)).toBeNull();
    expect(cameraFromTransform('matrix(-1, 0, 0, -1, 0, 0)', viewport)).toBeNull();
    expect(cameraFromTransform('matrix(NaN, 0, 0, 1, 0, 0)', viewport)).toBeNull();
  });

  it('rebases from visible poses before cancellation and never restarts on clock-only renders', () => {
    const calls: string[] = [];
    const session = new CameraMotionSession();
    const initial = playerCamera([cell()], 'p1', viewport)!;
    let visible: Camera = initial;
    let visiblePoses = ownedCameraPoses([cell()], 'p1');
    const animations: {
      frames: { offset: number; transform: string }[];
      options: KeyframeAnimationOptions;
    }[] = [];
    const surface: CameraSurface = {
      readCamera: () => {
        calls.push('readCamera');
        return visible;
      },
      readPoses: () => {
        calls.push('readPoses');
        return visiblePoses;
      },
      setTransform: () => {
        calls.push('set');
      },
      animate: (frames, options) => {
        calls.push('animate');
        animations.push({ frames, options });
        return {
          cancel: () => {
            calls.push('cancel');
          },
        };
      },
    };
    session.update(surface, 'p1:390:500', initial, visiblePoses, false);
    expect(calls).toEqual(['set']);
    const next = [cell({ x: 84, mass: 96 })];
    session.update(
      surface,
      'p1:390:500',
      playerCamera(next, 'p1', viewport),
      ownedCameraPoses(next, 'p1'),
      false,
    );
    const count = animations.length;
    session.update(
      surface,
      'p1:390:500',
      playerCamera(next, 'p1', viewport),
      ownedCameraPoses(next, 'p1'),
      false,
    );
    expect(animations).toHaveLength(count);
    visible = { ...initial, x: 81, zoom: 9.3 };
    visiblePoses = [{ id: 1, x: 82, y: 50, radius: 3.5 }];
    calls.length = 0;
    const third = [cell({ x: 86, mass: 192 })];
    session.update(
      surface,
      'p1:390:500',
      playerCamera(third, 'p1', viewport),
      ownedCameraPoses(third, 'p1'),
      false,
    );
    expect(calls).toEqual(['readCamera', 'readPoses', 'cancel', 'set', 'animate']);
    expect(animations.at(-1)!.frames[0]!.transform).toBe(cameraTransform(visible));
    const first = cameraFromTransform(animations.at(-1)!.frames[1]!.transform, viewport)!;
    expect(first.x).toBeCloseTo(81.59718518518519);
    expect(animations.at(-1)!.options).toEqual({ duration: 2000, fill: 'both', easing: 'linear' });
    session.cancel();
    session.cancel();
    expect(calls.filter((call) => call === 'cancel')).toHaveLength(2);
  });

  it('cancels and snaps on pause/reduced motion, identity/viewport changes and overview', () => {
    const session = new CameraMotionSession();
    let cancelled = 0;
    let animated = 0;
    let written = '';
    const initial = playerCamera([cell()], 'p1', viewport)!;
    const poses = ownedCameraPoses([cell()], 'p1');
    const surface: CameraSurface = {
      readCamera: () => initial,
      readPoses: () => poses,
      setTransform: (value) => {
        written = value;
      },
      animate: () => {
        animated++;
        return {
          cancel: () => {
            cancelled++;
          },
        };
      },
    };
    session.update(surface, 'p1:390:500', initial, poses, true);
    const moved = ownedCameraPoses([cell({ x: 84 })], 'p1');
    const target = playerCamera([cell({ x: 84 })], 'p1', viewport)!;
    session.update(surface, 'p1:390:500', target, moved, false);
    expect(animated).toBe(1);
    session.update(surface, 'p1:390:500', target, moved, true);
    expect(cancelled).toBe(1);
    expect(written).toBe(cameraTransform(target));
    session.update(surface, 'p2:390:500', initial, poses, false);
    session.update(surface, 'p2:390:400', { ...initial, height: 400 }, poses, false);
    expect(animated).toBe(1);
    session.update(surface, 'overview', null, [], false);
    expect(written).toBe('');
    session.update(surface, 'p1:390:500', target, moved, false);
    expect(animated).toBe(1);
    expect(written).toBe(cameraTransform(target));
  });

  it('uses the precommit camera/body snapshot even when growth reorder exposes only destination DOM poses', () => {
    const session = new CameraMotionSession();
    const oldCells = [cell()];
    const newCells = [cell({ x: 84, mass: 96 })];
    const start = playerCamera(oldCells, 'p1', viewport)!;
    const oldPoses = ownedCameraPoses(oldCells, 'p1');
    const nextPoses = ownedCameraPoses(newCells, 'p1');
    let frames: { offset: number; transform: string }[] = [];
    const surface: CameraSurface = {
      readCamera: () => {
        throw new Error('Postcommit camera must not replace captured geometry');
      },
      readPoses: () => nextPoses,
      setTransform: () => {},
      animate: (value) => {
        frames = value;
        return { cancel() {} };
      },
    };
    session.update(surface, 'same', start, oldPoses, false);
    session.update(surface, 'same', playerCamera(newCells, 'p1', viewport), nextPoses, false, {
      camera: start,
      poses: oldPoses,
    });
    const at50 = cameraFromTransform(frames[3]!.transform, viewport)!;
    expect(at50.x).toBeCloseTo(80.96189331054688, 5);
    expect(at50.zoom).toBeCloseTo(9.42063114859841, 5);
  });

  it('preserves120ms body travel and radius through reordered pieces and rebases rapid updates from rendered geometry', () => {
    const session = new PoseMotionSession();
    const starts = ownedCameraPoses([cell(), cell({ id: 2, x: 90, mass: 60 })], 'p1');
    const grown = ownedCameraPoses(
      [cell({ id: 2, x: 90, mass: 60 }), cell({ x: 84, mass: 96 })],
      'p1',
    );
    const received: {
      type: string;
      id: number;
      from: CameraPose;
      to: CameraPose;
      options: KeyframeAnimationOptions;
    }[] = [];
    let cancelled = 0;
    const record =
      (type: string): PoseSurface['animatePose'] =>
      (id, from, to, options) => {
        received.push({ type, id, from, to, options });
        return {
          cancel: () => {
            cancelled++;
          },
        };
      };
    const outlines: { offset: number; r: string }[][] = [];
    const fonts: { offset: number; fontSize: string; transform: string; easing?: string }[][] = [];
    const surface: PoseSurface = {
      animatePose: record('pose'),
      animateRadius: record('radius'),
      animateOutlineRadius: (_id, frames) => {
        outlines.push(frames);
        return {
          cancel: () => {
            cancelled++;
          },
        };
      },
      animateNameFont: (_id, frames) => {
        fonts.push(frames);
        return {
          cancel: () => {
            cancelled++;
          },
        };
      },
    };
    session.update(surface, 'same', [], starts, false);
    session.update(surface, 'same', starts, grown, false);
    expect(received.map((value) => [value.type, value.id])).toEqual([
      ['pose', 1],
      ['radius', 1],
    ]);
    expect(received[0]!.from.x).toBe(80);
    expect(received[0]!.to.x).toBe(84);
    expect(received[1]!.from.radius).toBe(starts[0]!.radius);
    expect(received.every((value) => value.options.duration === 120)).toBe(true);
    const half = starts.map((pose) =>
      pose.id === 1
        ? { ...pose, x: 82, radius: 3.5, outlineRadius: 2.8, fontSize: 1.21, baseline: 0.085 }
        : pose,
    );
    const next = ownedCameraPoses([cell({ x: 86, mass: 192 })], 'p1');
    session.update(surface, 'same', half, next, false);
    expect(cancelled).toBe(4);
    expect(received[2]!.from).toEqual(half[0]);
    expect(received[3]!.from.radius).toBe(3.5);
    expect(outlines[1]![0]!.r).toBe('2.8px');
    expect(fonts[1]![0]!.fontSize).toBe('1.21px');
    expect(fonts[1]![0]!.transform).toBe('translate(0px, 0.085px)');
    session.update(surface, 'same', next, next, false);
    expect(received).toHaveLength(4);
    session.update(surface, 'same', next, next, true);
    expect(cancelled).toBe(8);
    session.cancel();
    expect(cancelled).toBe(8);
    session.update(surface, 'new-owner', next, starts, false);
    expect(received).toHaveLength(4);
  });

  it('keeps the painted outline behind logical growth, close to independent original filled bounds', () => {
    const from = ownedCameraPoses([cell()], 'p1')[0]!;
    const to = ownedCameraPoses([cell({ mass: 96 })], 'p1')[0]!;
    const frames = outlineMotionFrames(from, to);
    // Actual archived filled bounds include random point wobble. The circular
    // envelope stays within half a phone pixel at these independently captured moments.
    const reference = [
      { frame: 3, radius: 2.8146501082199102, zoom: 9.42063114859841 },
      { frame: 6, radius: 3.275257804103573, zoom: 9.302779761227693 },
      { frame: 9, radius: 3.786560683714387, zoom: 9.083687175403941 },
    ];
    for (const sample of reference) {
      const actual = Number.parseFloat(frames[sample.frame]!.r);
      expect(Math.abs(actual - sample.radius) * sample.zoom).toBeLessThan(0.5);
    }
    expect(frames).toHaveLength(121);
    expect(Number.parseFloat(frames.at(-1)!.r)).toBe(to.radius);
    const shrinking = outlineMotionFrames({ ...to, outlineRadius: 5 }, from);
    expect(Number.parseFloat(shrinking[3]!.r)).toBeGreaterThan(from.radius);
    expect(Number.parseFloat(shrinking.at(-1)!.r)).toBe(from.radius);
  });

  it('steps original names from logical radius rather than lagging outline or final received mass', () => {
    const from = ownedCameraPoses([cell()], 'p1')[0]!;
    const to = ownedCameraPoses([cell({ mass: 96 })], 'p1')[0]!;
    const frames = nameMotionFrames({ ...from, outlineRadius: 1 }, to);
    expect(Number.parseFloat(frames[3]!.fontSize) * CAMERA_UNITS).toBeCloseTo(22);
    expect(Number.parseFloat(frames[6]!.fontSize) * CAMERA_UNITS).toBeCloseTo(26);
    expect(Number.parseFloat(frames.at(-1)!.fontSize) * CAMERA_UNITS).toBeCloseTo(27);
    const baseline = (index: number): number =>
      Number(frames[index]!.transform.match(/, ([^p]+)px\)/)![1]);
    expect(baseline(3)).toBeCloseTo(0.105);
    expect(baseline(6)).toBeCloseTo(0.215);
    expect(baseline(8)).toBeCloseTo(0.27);
    expect(frames.every((frame) => frame.easing === 'steps(1, end)')).toBe(true);
    expect(frames.at(-1)!.offset).toBe(1);
    expect(nameMotionFrames({ ...from, fontSize: 1.43 }, to)[0]!.fontSize).toBe('1.43px');
  });

  it('uses the original alphabetic cached-text baseline at known static coordinates', () => {
    expect(cellNameBaseline(0.55 * Math.sqrt(24), 50)).toBeCloseTo(0.105);
    expect(cellNameBaseline(0.55 * Math.sqrt(192), 48)).toBeCloseTo(0.565);
    expect(cellNameBaseline(0.55 * Math.sqrt(96), 48)).toBeCloseTo(0.235);
    expect(cellNameBaseline(0.55 * Math.sqrt(24), 5)).toBeCloseTo(0.06);
    const from = ownedCameraPoses([cell({ y: 50 })], 'p1')[0]!;
    const to = ownedCameraPoses([cell({ y: 48, mass: 96 })], 'p1')[0]!;
    const frames = nameMotionFrames({ ...from, baseline: 0.03 }, to);
    expect(frames[0]!.transform).toBe('translate(0px, 0.03px)');
    expect(Number(frames.at(-1)!.transform.match(/, ([^p]+)px\)/)![1])).toBeCloseTo(0.235);
  });
});

describe('inside cell identity', () => {
  it('keeps grid behind every personal viewport corner at a legal map edge without clipping protruding cells', () => {
    const cells = [cell({ x: 4, y: 5 })];
    const props = {
      cells,
      pellets: [],
      players: [
        { id: 'p1', name: 'Ana', avatarId: 'fox', connected: true, status: 'active' as const },
      ],
      slots: { p1: 0 },
      checked: 0,
    };
    const html = renderToStaticMarkup(<Arena {...props} mine="p1" follow phone />);
    const grid = html.match(/<rect[^>]*data-grid-background="true"[^>]*>/)![0];
    const value = (attribute: string): number =>
      Number(grid.match(new RegExp(` ${attribute}="([^"]+)"`))![1]);
    const bounds = {
      left: value('x'),
      top: value('y'),
      right: value('x') + value('width'),
      bottom: value('y') + value('height'),
    };
    const projection = playerCamera(cells, 'p1', { width: 362, height: 420 })!;
    expect(projection.x - projection.width / (2 * projection.zoom)).toBeLessThan(0);
    expect(projection.y - projection.height / (2 * projection.zoom)).toBeLessThan(0);
    for (const x of [0, projection.width])
      for (const y of [0, projection.height]) {
        const worldX = projection.x + (x - projection.width / 2) / projection.zoom;
        const worldY = projection.y + (y - projection.height / 2) / projection.zoom;
        expect(worldX).toBeGreaterThanOrEqual(bounds.left);
        expect(worldX).toBeLessThanOrEqual(bounds.right);
        expect(worldY).toBeGreaterThanOrEqual(bounds.top);
        expect(worldY).toBeLessThanOrEqual(bounds.bottom);
      }
    expect(html).not.toContain('clip-path=');
    expect(html).toContain('data-world-background="viewport"');
    const tv = renderToStaticMarkup(<Arena {...props} />);
    expect(tv).toContain('clip-path=');
    expect(tv).toContain('data-world-background="map"');
  });

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
  it('uses the classic name-size minimum', () => {
    expect(cellNameSize(2.694438717)).toBeCloseTo(22 / CAMERA_UNITS);
    expect(cellNameSize(1)).toBeCloseTo(22 / CAMERA_UNITS);
  });

  it('keeps the full legal16-character public name centered on every split piece without autoshrinking', () => {
    const name = 'W'.repeat(16);
    const html = renderToStaticMarkup(
      <Arena
        cells={[cell(), cell({ id: 2, x: 86, mass: 12 }), cell({ id: 3, owner: 'p2', mass: 192 })]}
        pellets={[]}
        slots={{ p1: 0, p2: 1 }}
        checked={0}
        mine="p1"
        follow
        phone
        players={[
          { id: 'p1', name, avatarId: 'fox', connected: true, status: 'active' },
          { id: 'p2', name: 'Ben', avatarId: 'fox', connected: true, status: 'active' },
        ]}
      />,
    );
    const labels = [...html.matchAll(/<text([^>]*data-name-owner="p1"[^>]*)>([^<]*)<\/text>/g)];
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(label[2]).toBe(name);
      expect(Number(label[1]!.match(/font-size="([^"]+)"/)![1])).toBeCloseTo(22 / CAMERA_UNITS);
      expect(label[1]).toContain('x="0" y="0"');
      expect(label[1]).not.toMatch(/textLength|lengthAdjust/);
    }
    expect(html).not.toContain('…');
  });

  it('renders each split name at its true pose, preserves full accessible names and uses classic five-corner food', () => {
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
    expect(html.match(/data-cell-logical-radius="true"/g) ?? []).toHaveLength(2);
    expect(html.match(/data-name-owner="p1"/g) ?? []).toHaveLength(2);
    expect(html.match(/data-name-inside="true"/g) ?? []).toHaveLength(2);
    expect(html).toContain('Ana &lt;&amp;&gt;, blob 1');
    const snack = html.match(/<polygon[^>]*data-snack-id="1"[^>]*points="([^"]+)"/);
    expect(snack).not.toBeNull();
    expect(snack![1]!.split(' ')).toHaveLength(5);
    for (const pair of snack![1]!.split(' ')) {
      const [x, y] = pair.split(',').map(Number);
      expect(Math.hypot(x! - 30, y! - 20)).toBeCloseTo(0.6);
    }
    expect(foodPoints(0, 0, 20).split(' ')).toHaveLength(12);
    expect(html).not.toContain('data-cell-label-backplate');
    expect(html).not.toContain('data-number-leader');
    expect(html).not.toMatch(/<path[^>]*d="[^"]*Q/);
  });
});
