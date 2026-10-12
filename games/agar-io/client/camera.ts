// Presentation only: this camera projects received cells and never advances physics.
import { radius } from '../server/geometry';
import type { Cell } from '../server/types';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

// May 1, 2015 official-client archive (Tombez pin 4e25418ae81043f391557422a5ee19f3f0c2e588).
// It expresses mass as radius² / 100. Our arena uses
// radius = sqrt(mass) × .55, so convert its camera units without copying code.
export const CAMERA_UNITS = 10 / 0.55;
export const CAMERA_MOTION_MS = 2000;
export const CAMERA_FRAME_COUNT = 120;

export interface CameraPose {
  id: number;
  x: number;
  y: number;
  radius: number;
  outlineRadius?: number;
  fontSize?: number;
  baseline?: number;
}

export function ownedCameraPoses(cells: readonly Cell[], owner: string | undefined): CameraPose[] {
  return cells
    .filter((cell) => owner !== undefined && cell.owner === owner)
    .map((cell) => ({ id: cell.id, x: cell.x, y: cell.y, radius: radius(cell.mass) }));
}

function radiusZoom(
  poses: readonly CameraPose[],
  viewport: { width: number; height: number },
): number {
  const sumRadii = poses.reduce((sum, pose) => sum + pose.radius, 0) * CAMERA_UNITS;
  return (
    Math.min(1, 64 / Math.max(1, sumRadii)) ** 0.25 *
    Math.max(viewport.height / 965, viewport.width / 1920) *
    CAMERA_UNITS
  );
}

export function playerCamera(
  cells: readonly Cell[],
  owner: string | undefined,
  viewport: { width: number; height: number },
): Camera | null {
  const owned = ownedCameraPoses(cells, owner);
  if (!owned.length) return null;
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const zoom = radiusZoom(owned, { width, height });
  return {
    x: owned.reduce((sum, cell) => sum + cell.x, 0) / owned.length,
    y: owned.reduce((sum, cell) => sum + cell.y, 0) / owned.length,
    zoom,
    width,
    height,
  };
}

export function cameraTransform(camera: Camera): string {
  return `matrix(${camera.zoom}, 0, 0, ${camera.zoom}, ${camera.width / 2 - camera.x * camera.zoom}, ${camera.height / 2 - camera.y * camera.zoom})`;
}

export function cameraFromTransform(
  transform: string,
  viewport: { width: number; height: number },
): Camera | null {
  const match = /^matrix\(([^)]+)\)$/.exec(transform);
  const values = match?.[1]?.split(',').map(Number);
  if (!values || values.length !== 6 || !values.every(Number.isFinite)) return null;
  const [a, b, c, d, e, f] = values as [number, number, number, number, number, number];
  if (a <= 0 || Math.abs(a - d) > 0.001 || Math.abs(b) > 0.001 || Math.abs(c) > 0.001) return null;
  return {
    x: (viewport.width / 2 - e) / a,
    y: (viewport.height / 2 - f) / d,
    zoom: a,
    width: viewport.width,
    height: viewport.height,
  };
}

export interface CameraFrame {
  offset: number;
  transform: string;
  camera: Camera;
}

// Independently projected archive feedback, sampled once per received snapshot.
// The reference renderer uses integer Date.now values and a 60Hz fixture clock.
// Zoom reads the PRIOR rendered radii; only then do poses and the half-step pan advance.
export function cameraMotionFrames(
  start: Camera,
  from: readonly CameraPose[],
  to: readonly CameraPose[],
): CameraFrame[] {
  if (!to.length) return [];
  const previous = new Map(from.map((pose) => [pose.id, pose]));
  const origins = to.map((pose) => previous.get(pose.id) ?? pose);
  let rendered = origins;
  let camera = { ...start };
  const frames: CameraFrame[] = [{ offset: 0, transform: cameraTransform(camera), camera }];
  for (let frame = 1; frame <= CAMERA_FRAME_COUNT; frame++) {
    const zoom = camera.zoom * 0.9 + radiusZoom(rendered, start) * 0.1;
    const t = Math.min(1, Math.floor((frame * CAMERA_MOTION_MS) / CAMERA_FRAME_COUNT) / 120);
    const progress = t * t * (3 - 2 * t);
    rendered = to.map((pose, index) => {
      const origin = origins[index]!;
      return {
        id: pose.id,
        x: origin.x + (pose.x - origin.x) * progress,
        y: origin.y + (pose.y - origin.y) * progress,
        radius: origin.radius + (pose.radius - origin.radius) * progress,
      };
    });
    const x = rendered.reduce((sum, pose) => sum + pose.x, 0) / rendered.length;
    const y = rendered.reduce((sum, pose) => sum + pose.y, 0) / rendered.length;
    camera = { ...start, x: (camera.x + x) / 2, y: (camera.y + y) / 2, zoom };
    if (frame === CAMERA_FRAME_COUNT) camera = { ...start, x, y, zoom: radiusZoom(to, start) };
    frames.push({ offset: frame / CAMERA_FRAME_COUNT, transform: cameraTransform(camera), camera });
  }
  return frames;
}

export interface CameraSurface {
  readCamera(target: Camera): Camera | null;
  readPoses(targets: readonly CameraPose[]): CameraPose[];
  setTransform(transform: string): void;
  animate(
    frames: { offset: number; transform: string }[],
    options: KeyframeAnimationOptions,
  ): { cancel(): void };
}

export interface CameraSnapshot {
  camera: Camera | null;
  poses: CameraPose[];
}

// At most one native transform animation. Rebase before cancellation, never in a frame loop.
export class CameraMotionSession {
  private animation: { cancel(): void } | null = null;
  private previous: {
    context: string;
    camera: Camera;
    poses: CameraPose[];
    signature: string;
  } | null = null;

  cancel(): void {
    this.animation?.cancel();
    this.animation = null;
  }

  update(
    surface: CameraSurface,
    context: string,
    target: Camera | null,
    poses: CameraPose[],
    frozen: boolean,
    captured?: CameraSnapshot | null,
  ): void {
    if (!target) {
      this.cancel();
      surface.setTransform('');
      this.previous = null;
      return;
    }
    const signature = poses
      .map((pose) => `${pose.id}:${pose.x}:${pose.y}:${pose.radius}`)
      .join('|');
    const previous = this.previous;
    if (!previous || previous.context !== context || frozen) {
      this.cancel();
      surface.setTransform(cameraTransform(target));
    } else if (previous.signature !== signature) {
      const start = captured?.camera ?? surface.readCamera(target) ?? previous.camera;
      const visible = captured?.poses ?? surface.readPoses(poses);
      const origins = poses.map(
        (pose) =>
          visible.find((value) => value.id === pose.id) ??
          previous.poses.find((value) => value.id === pose.id) ??
          pose,
      );
      this.cancel();
      surface.setTransform(cameraTransform(target));
      this.animation = surface.animate(
        cameraMotionFrames(start, origins, poses).map(({ offset, transform }) => ({
          offset,
          transform,
        })),
        { duration: CAMERA_MOTION_MS, fill: 'both', easing: 'linear' },
      );
    }
    this.previous = { context, camera: target, poses, signature };
  }
}

export interface PoseSurface {
  animatePose(
    id: number,
    from: CameraPose,
    to: CameraPose,
    options: KeyframeAnimationOptions,
  ): { cancel(): void };
  animateRadius(
    id: number,
    from: CameraPose,
    to: CameraPose,
    options: KeyframeAnimationOptions,
  ): { cancel(): void };
  animateOutlineRadius(
    id: number,
    frames: { offset: number; r: string }[],
    options: KeyframeAnimationOptions,
  ): { cancel(): void };
  animateNameFont(
    id: number,
    frames: { offset: number; fontSize: string; transform: string; easing?: string }[],
    options: KeyframeAnimationOptions,
  ): { cancel(): void };
}

// The outline's neighboring points add a second feedback stage after logical
// radius interpolation. Its circular envelope uses the independently derived
// long-ring weight4/45. It does not simulate random vertex wobble or contact indentation.
export function outlineMotionFrames(
  from: CameraPose,
  to: CameraPose,
): { offset: number; r: string }[] {
  let outline = from.outlineRadius ?? from.radius;
  const frames = [{ offset: 0, r: `${outline}px` }];
  for (let frame = 1; frame <= CAMERA_FRAME_COUNT; frame++) {
    const t = Math.min(1, Math.floor((frame * CAMERA_MOTION_MS) / CAMERA_FRAME_COUNT) / 120);
    const logical = from.radius + (to.radius - from.radius) * t * t * (3 - 2 * t);
    outline += (logical - outline) * (4 / 45);
    if (frame === CAMERA_FRAME_COUNT) outline = to.radius;
    frames.push({ offset: frame / CAMERA_FRAME_COUNT, r: `${outline}px` });
  }
  return frames;
}

export function nameMotionFrames(
  from: CameraPose,
  to: CameraPose,
): { offset: number; fontSize: string; transform: string; easing: string }[] {
  const frames = [
    {
      offset: 0,
      fontSize: `${from.fontSize ?? cellNameSize(from.radius)}px`,
      transform: `translate(0px, ${from.baseline ?? cellNameBaseline(from.radius, from.y)}px)`,
      easing: 'steps(1, end)',
    },
  ];
  for (let frame = 1; frame <= 8; frame++) {
    const elapsed = Math.min(120, (frame * 1000) / 60);
    const t = Math.min(1, Math.floor(elapsed) / 120);
    const logical = from.radius + (to.radius - from.radius) * t * t * (3 - 2 * t);
    const y = from.y + (to.y - from.y) * t * t * (3 - 2 * t);
    frames.push({
      offset: elapsed / 120,
      fontSize: `${cellNameSize(logical)}px`,
      transform: `translate(0px, ${cellNameBaseline(logical, y)}px)`,
      easing: 'steps(1, end)',
    });
  }
  return frames;
}

export class PoseMotionSession {
  private animations: { cancel(): void }[] = [];
  private previous: { context: string; signature: string } | null = null;

  cancel(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
  }

  update(
    surface: PoseSurface,
    context: string,
    captured: readonly CameraPose[],
    targets: readonly CameraPose[],
    frozen: boolean,
  ): void {
    const signature = targets
      .map((pose) => `${pose.id}:${pose.x}:${pose.y}:${pose.radius}`)
      .join('|');
    if (!this.previous || this.previous.context !== context || frozen) {
      this.cancel();
    } else if (this.previous.signature !== signature) {
      this.cancel();
      const origins = new Map(captured.map((pose) => [pose.id, pose]));
      const options: KeyframeAnimationOptions = {
        duration: 120,
        fill: 'both',
        easing: 'cubic-bezier(0.3333333333, 0, 0.6666666667, 1)',
      };
      for (const target of targets) {
        const origin = origins.get(target.id);
        if (!origin) continue;
        if (Math.hypot(origin.x - target.x, origin.y - target.y) > 0.0001)
          this.animations.push(surface.animatePose(target.id, origin, target, options));
        if (Math.abs(origin.radius - target.radius) > 0.0001)
          this.animations.push(surface.animateRadius(target.id, origin, target, options));
        if (Math.abs((origin.outlineRadius ?? origin.radius) - target.radius) > 0.0001)
          this.animations.push(
            surface.animateOutlineRadius(target.id, outlineMotionFrames(origin, target), {
              duration: CAMERA_MOTION_MS,
              fill: 'both',
              easing: 'linear',
            }),
          );
        if (
          Math.abs(origin.radius - target.radius) > 0.0001 ||
          Math.abs(origin.y - target.y) > 0.0001 ||
          Math.abs(
            (origin.baseline ?? cellNameBaseline(origin.radius, origin.y)) -
              cellNameBaseline(target.radius, target.y),
          ) > 0.0001 ||
          Math.abs((origin.fontSize ?? cellNameSize(origin.radius)) - cellNameSize(target.radius)) >
            0.0001
        )
          this.animations.push(
            surface.animateNameFont(target.id, nameMotionFrames(origin, target), {
              duration: 120,
              fill: 'both',
              easing: 'linear',
            }),
          );
      }
    }
    this.previous = { context, signature };
  }
}

// Classic tiny food is a rounded polygon; its five corners remain visible at phone zoom.
export function foodPoints(x: number, y: number, zoom: number): string {
  const count = Math.min(64, Math.max(5, Math.floor(0.6 * zoom)));
  return Array.from({ length: count }, (_, index) => {
    const angle = (index * Math.PI * 2) / count;
    return `${x + Math.cos(angle) * 0.6},${y + Math.sin(angle) * 0.6}`;
  }).join(' ');
}

export function cellNameSize(cellRadius: number): number {
  return (Math.max(Math.floor(cellRadius * CAMERA_UNITS * 0.3), 24) - 2) / CAMERA_UNITS;
}

// Original cached text uses an alphabetic baseline inside an integer-sized
// texture, drawn at an integer original-world y. Preserve that geometry in SVG.
export function cellNameBaseline(cellRadius: number, y: number): number {
  const originalFont = Math.max(Math.floor(cellRadius * CAMERA_UNITS * 0.3), 24) - 2;
  const originalY = y * CAMERA_UNITS;
  return (Math.trunc(originalY) - originalY + Math.ceil(originalFont / 2) - 9) / CAMERA_UNITS;
}
