// Original low-poly meshes projected from world XYZ. No images or graphics dependency.
import type { CityView, HoleView, PropKind } from '../server/types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Point {
  x: number;
  y: number;
}
export type Material =
  'body' | 'side' | 'roof' | 'glass' | 'dark' | 'light' | 'leaf' | 'leafLight' | 'wood';
export interface Face {
  points: Vec3[];
  material: Material;
}
export interface Camera {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  target: string | null;
  depth: number;
}

export function cameraFor(
  city: CityView,
  mine: string | undefined,
  compact: boolean,
  viewport?: { width: number; height: number },
): Camera {
  const live = city.holes.filter((h) => h.alive !== false && !h.left);
  const own = live.find((h) => h.id === mine);
  const leader = [...live].sort(
    (a, b) => Number(b.connected) - Number(a.connected) || b.score - a.score || a.slot - b.slot,
  )[0];
  const focus = own ?? leader ?? city.holes.find((h) => h.id === mine) ?? city.holes[0];
  return {
    x: focus?.x ?? 90,
    y: focus?.y ?? 55,
    scale: (viewport?.width ?? 640) / (40 + (focus?.radius ?? 2.2) * 3.2),
    width: viewport?.width ?? 640,
    height: viewport?.height ?? (compact ? 480 : 360),
    target: focus?.id ?? null,
    depth: (40 + (focus?.radius ?? 2.2) * 3.2) * 2,
  };
}

export function project(p: Vec3, camera: Camera): Point {
  const dx = p.x - camera.x,
    dy = p.y - camera.y;
  const perspective =
    camera.depth /
    Math.max(camera.depth * 0.25, camera.depth - (dy + dx * 0.12) * 0.82 - p.z * 0.72);
  return {
    x: camera.width / 2 + (dx - dy * 0.12) * camera.scale * perspective,
    y:
      camera.height * 0.62 +
      ((dy + dx * 0.12) * camera.scale * 0.72 - p.z * camera.scale * 0.82) * perspective,
  };
}

// Clip in 3D before projection: a sinking object's lower faces disappear into the ground.
export function clipGround(points: Vec3[]): Vec3[] {
  const clipped: Vec3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!;
    if (a.z >= 0) clipped.push(a);
    if (a.z >= 0 !== b.z >= 0) {
      const t = a.z / (a.z - b.z);
      clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 });
    }
  }
  return clipped;
}

export function polygon(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

export function inFrame(
  x: number,
  y: number,
  radius: number,
  height: number,
  camera: Camera,
): boolean {
  const foot = project({ x, y, z: 0 }, camera),
    top = project({ x, y, z: height }, camera);
  const margin = (radius + 1) * camera.scale;
  return (
    foot.x + margin >= 0 &&
    foot.x - margin <= camera.width &&
    foot.y + margin >= 0 &&
    top.y - margin <= camera.height
  );
}

function box(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  body: Material = 'body',
  top: Material = 'roof',
): Face[] {
  const a = { x: x - w / 2, y: y - d / 2, z },
    b = { x: x + w / 2, y: y - d / 2, z };
  const c = { x: x + w / 2, y: y + d / 2, z },
    e = { x: x - w / 2, y: y + d / 2, z };
  const up = (p: Vec3): Vec3 => ({ ...p, z: p.z + h });
  return [
    { points: [a, up(a), up(e), e], material: 'side' },
    { points: [e, up(e), up(c), c], material: body },
    { points: [c, up(c), up(b), b], material: 'side' },
    { points: [up(a), up(b), up(c), up(e)], material: top },
  ];
}

function frontWindow(x: number, y: number, z: number, w: number, h: number): Face {
  return {
    points: [
      { x: x - w / 2, y, z },
      { x: x - w / 2, y, z: z + h },
      { x: x + w / 2, y, z: z + h },
      { x: x + w / 2, y, z },
    ],
    material: 'glass',
  };
}

function building(tall: boolean): Face[] {
  const w = tall ? 12 : 5.4,
    d = tall ? 11 : 6,
    h = tall ? 17 : 9;
  const faces = box(0, 0, 0, w, d, h);
  faces.push(...box(1.2, -0.7, h, tall ? 4 : 2.4, 2.5, 1.5, 'side', 'light'));
  const rows = tall ? 6 : 3,
    columns = tall ? 4 : 3;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const x = -w / 2 + 0.85 + (c * (w - 1.7)) / (columns - 1),
        z = 1.1 + r * 2.4;
      faces.push(frontWindow(x, d / 2 + 0.025, z, tall ? 1.35 : 0.9, 1.55));
      // Windows on the visible side, with XYZ rather than painted top-down symbols.
      faces.push({
        points: [
          { x: -w / 2 - 0.025, y: -d / 2 + 0.7 + (c * (d - 2)) / (columns - 1), z },
          { x: -w / 2 - 0.025, y: -d / 2 + 1.6 + (c * (d - 2)) / (columns - 1), z },
          { x: -w / 2 - 0.025, y: -d / 2 + 1.6 + (c * (d - 2)) / (columns - 1), z: z + 1.55 },
          { x: -w / 2 - 0.025, y: -d / 2 + 0.7 + (c * (d - 2)) / (columns - 1), z: z + 1.55 },
        ].reverse(),
        material: 'glass',
      });
    }
  faces.push(frontWindow(0, d / 2 + 0.035, 0, 1.8, 2.2));
  return faces;
}

export function mesh(kind: PropKind): Face[] {
  switch (kind) {
    case 'bin':
      return [
        ...box(0, 0, 0, 1.2, 1.5, 1.8, 'body', 'light'),
        ...box(0, 0, 1.8, 1.4, 1.7, 0.2, 'side', 'roof'),
      ];
    case 'bench':
      return [
        ...box(-1.5, 0, 0, 0.3, 1.2, 1.2, 'dark', 'dark'),
        ...box(1.5, 0, 0, 0.3, 1.2, 1.2, 'dark', 'dark'),
        ...box(0, 0, 1.1, 4.3, 1.1, 0.25, 'wood', 'wood'),
        ...box(0, -0.5, 1.2, 4.3, 0.22, 1.3, 'wood', 'wood'),
      ];
    case 'car':
      return [
        ...box(-2.35, -1.9, 0.1, 0.65, 1.1, 0.85, 'dark', 'dark'),
        ...box(2.35, -1.9, 0.1, 0.65, 1.1, 0.85, 'dark', 'dark'),
        ...box(-2.35, 1.9, 0.1, 0.65, 1.1, 0.85, 'dark', 'dark'),
        ...box(2.35, 1.9, 0.1, 0.65, 1.1, 0.85, 'dark', 'dark'),
        ...box(0, 0, 0.6, 4.7, 6.2, 1.2),
        ...box(0, 0.15, 1.8, 3.8, 3.1, 1.25, 'glass', 'body'),
        frontWindow(-1.6, 3.13, 1, 0.9, 0.4),
        frontWindow(1.6, 3.13, 1, 0.9, 0.4),
      ];
    case 'house':
      return building(false);
    case 'tower':
      return building(true);
    case 'tree': {
      const trunk = box(0, 0, 0, 0.55, 0.55, 2.4, 'wood', 'wood');
      const ring = Array.from({ length: 5 }, (_, i) => ({
        x: Math.cos((i * Math.PI * 2) / 5) * 1.6,
        y: Math.sin((i * Math.PI * 2) / 5) * 1.6,
        z: 3.1,
      }));
      const top = { x: 0, y: 0, z: 5.1 },
        bottom = { x: 0, y: 0, z: 1.7 };
      return [
        ...trunk,
        ...ring.flatMap((p, i) => [
          {
            points: [p, ring[(i + 1) % 5]!, top],
            material: i % 2 ? 'leaf' : ('leafLight' as Material),
          },
          { points: [ring[(i + 1) % 5]!, p, bottom], material: 'leaf' as Material },
        ]),
      ];
    }
  }
}

export const MODEL_HEIGHT: Record<PropKind, number> = {
  bin: 2,
  tree: 5.1,
  bench: 2.5,
  car: 3.1,
  house: 10.5,
  tower: 18.5,
};
const MODELS: Record<PropKind, Face[]> = {
  bin: mesh('bin'),
  tree: mesh('tree'),
  bench: mesh('bench'),
  car: mesh('car'),
  house: mesh('house'),
  tower: mesh('tower'),
};

export function objectFaces(kind: PropKind, x: number, y: number, tilt = 0, sink = 0): Face[] {
  const cos = Math.cos(tilt),
    sin = Math.sin(tilt);
  return MODELS[kind]
    .map((face) => ({
      material: face.material,
      points: clipGround(
        face.points.map((p) => ({
          x: x + p.x * cos + p.z * sin,
          y: y + p.y,
          z: p.z * cos - p.x * sin - sink,
        })),
      ),
    }))
    .filter((face) => face.points.length >= 3);
}

export function liveHole(h: HoleView): boolean {
  return h.alive !== false && !h.left;
}
