// A game's pieces directory (`games/<id>/pieces/`): GLB files read into the polygon meshes the tables draw.
// Pure and small on purpose (no three.js): a phone can load it. Replacing a .glb replaces the piece, no code edit.
import { useEffect, useState } from 'react';
import type { MeshData, Point3 } from './table3d/types';

/** One entry of a game's `pieces.json`: the file, the piece's real size in mm (x, y, z) and the file's up axis. */
export interface PieceEntry {
  file: string;
  mm: readonly [number, number, number];
  up: 'y' | 'z';
}
export type PieceManifest = Readonly<Record<string, PieceEntry>>;

const MAGIC = 0x46546c67,
  JSON_CHUNK = 0x4e4f534a,
  BIN_CHUNK = 0x004e4942,
  FLOAT = 5126,
  MAX_POINTS = 200_000;
const SIZES: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4 };
const COUNTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

interface Accessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}
interface GltfNode {
  mesh?: number;
  children?: number[];
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}
interface Gltf {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: GltfNode[];
  meshes?: {
    primitives: {
      attributes: { POSITION: number };
      indices?: number;
      material?: number;
      mode?: number;
    }[];
  }[];
  materials?: { name?: string }[];
  accessors?: Accessor[];
  bufferViews?: { byteOffset?: number; byteLength: number; byteStride?: number }[];
}
type Mat = readonly number[];

const IDENTITY: Mat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a: Mat, b: Mat): Mat {
  const out: number[] = [];
  for (let c = 0; c < 4; c += 1)
    for (let r = 0; r < 4; r += 1)
      out.push(
        a[r]! * b[c * 4]! +
          a[4 + r]! * b[c * 4 + 1]! +
          a[8 + r]! * b[c * 4 + 2]! +
          a[12 + r]! * b[c * 4 + 3]!,
      );
  return out;
}
function local(n: GltfNode): Mat {
  if (n.matrix?.length === 16) return n.matrix;
  const [tx = 0, ty = 0, tz = 0] = n.translation ?? [];
  const [x = 0, y = 0, z = 0, w = 1] = n.rotation ?? [];
  const [sx = 1, sy = 1, sz = 1] = n.scale ?? [];
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}
const apply = (m: Mat, p: Point3): Point3 => [
  m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!,
  m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!,
  m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!,
];
function unit(a: Point3, b: Point3, c: Point3): Point3 {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: Point3 = [
    u[1]! * v[2]! - u[2]! * v[1]!,
    u[2]! * v[0]! - u[0]! * v[2]!,
    u[0]! * v[1]! - u[1]! * v[0]!,
  ];
  const l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

/**
 * The faces of a GLB, in millimetres (the file is metres), y up. Triangles that continue one flat fan (what
 * the bake writes) are joined back into one polygon, so a baked piece reads exactly as it was built. A material
 * named `dark` or `bright` keeps that finish; every other material is the piece's tint. Null when the file is not
 * a GLB this reader understands (triangle meshes only), so the caller can draw nothing rather than throw.
 */
export function parseGlb(data: ArrayBuffer, up: 'y' | 'z' = 'y'): MeshData | null {
  try {
    const view = new DataView(data);
    if (view.getUint32(0, true) !== MAGIC) return null;
    let json: Gltf | undefined, bin: number | undefined;
    for (let at = 12; at + 8 <= view.byteLength;) {
      const length = view.getUint32(at, true),
        kind = view.getUint32(at + 4, true);
      if (kind === JSON_CHUNK)
        json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, at + 8, length))) as Gltf;
      else if (kind === BIN_CHUNK && bin === undefined) bin = at + 8;
      at += 8 + length;
    }
    if (!json || bin === undefined) return null;
    const g = json,
      start = bin;
    const read = (index: number): number[] | null => {
      const a = g.accessors?.[index],
        bv = a && g.bufferViews?.[a.bufferView];
      if (!a || !bv) return null;
      const n = COUNTS[a.type] ?? 0,
        size = a.componentType === FLOAT ? 4 : (SIZES[a.componentType] ?? 0);
      if (!n || !size || a.count > MAX_POINTS) return null;
      const stride = bv.byteStride ?? n * size,
        base = start + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
      const out: number[] = [];
      for (let i = 0; i < a.count; i += 1)
        for (let k = 0; k < n; k += 1) {
          const at = base + i * stride + k * size;
          out.push(
            a.componentType === FLOAT
              ? view.getFloat32(at, true)
              : size === 1
                ? view.getUint8(at)
                : size === 2
                  ? view.getUint16(at, true)
                  : view.getUint32(at, true),
          );
        }
      return out;
    };
    const faces: { points: Point3[]; material?: 'dark' | 'bright' }[] = [];
    const walk = (index: number, parent: Mat, depth: number): void => {
      const node = g.nodes?.[index];
      if (!node || depth > 32) return;
      const m = mul(parent, local(node));
      for (const prim of node.mesh === undefined ? [] : (g.meshes?.[node.mesh]?.primitives ?? [])) {
        if ((prim.mode ?? 4) !== 4) continue;
        const flat = read(prim.attributes.POSITION);
        if (!flat) continue;
        const pts: Point3[] = [];
        for (let i = 0; i + 2 < flat.length; i += 3)
          pts.push(apply(m, [flat[i]!, flat[i + 1]!, flat[i + 2]!]));
        const idx = prim.indices === undefined ? pts.map((_, i) => i) : read(prim.indices);
        if (!idx) continue;
        const name = prim.material === undefined ? undefined : g.materials?.[prim.material]?.name;
        const material = name === 'dark' || name === 'bright' ? name : undefined;
        let cur: { ids: number[]; n: Point3 } | undefined;
        const flush = (): void => {
          if (cur)
            faces.push({ points: cur.ids.map((i) => pts[i]!), ...(material ? { material } : {}) });
          cur = undefined;
        };
        for (let t = 0; t + 2 < idx.length; t += 3) {
          const [a, b, c] = [idx[t]!, idx[t + 1]!, idx[t + 2]!];
          if (!pts[a] || !pts[b] || !pts[c]) continue;
          const n = unit(pts[a], pts[b], pts[c]);
          if (
            cur &&
            cur.ids[0] === a &&
            cur.ids[cur.ids.length - 1] === b &&
            n[0] * cur.n[0] + n[1] * cur.n[1] + n[2] * cur.n[2] > 0.99999
          )
            cur.ids.push(c);
          else {
            flush();
            cur = { ids: [a, b, c], n };
          }
        }
        flush();
      }
      for (const child of node.children ?? []) walk(child, m, depth + 1);
    };
    const roots = g.scenes?.[g.scene ?? 0]?.nodes ?? [];
    for (const root of roots) walk(root, IDENTITY, 0);
    if (faces.length === 0 || faces.length > MAX_POINTS) return null;
    // glTF is metres; the tables fit a piece by its extents, so only the proportions matter.
    return faces.map((f) => ({
      ...f,
      points: f.points.map((p): Point3 =>
        up === 'z'
          ? [p[0] * 1000, p[2] * 1000, -p[1] * 1000]
          : [p[0] * 1000, p[1] * 1000, p[2] * 1000],
      ),
    }));
  } catch {
    return null;
  }
}

const cache = new Map<string, Promise<MeshData | null>>();
const done = new Map<string, MeshData>();
const keyOf = (url: string, up: 'y' | 'z'): string => `${up}:${url}`;

/** Fetches and reads a piece once per url and up axis; a failed load is dropped from the cache so the next call retries. */
export function loadPiece(url: string, up: 'y' | 'z' = 'y'): Promise<MeshData | null> {
  const key = keyOf(url, up);
  let hit = cache.get(key);
  if (!hit) {
    hit = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((buf) => parseGlb(buf, up))
      .catch(() => null);
    const mine = hit;
    void mine.then((mesh) => {
      if (mesh) done.set(key, mesh);
      else if (cache.get(key) === mine) cache.delete(key);
    });
    cache.set(key, hit);
  }
  return hit;
}

/** The piece if it has already loaded (a screen that comes back draws it on its first frame, with no gap). */
export function peekPiece(url: string, up: 'y' | 'z' = 'y'): MeshData | undefined {
  return done.get(keyOf(url, up));
}

/** Re-renders the caller each time one of `files` arrives. */
function useArrival(files: readonly { url: string; up: 'y' | 'z' }[]): void {
  const [, bump] = useState(0);
  const wanted = JSON.stringify(files);
  useEffect(() => {
    let live = true;
    for (const f of JSON.parse(wanted) as { url: string; up: 'y' | 'z' }[])
      void loadPiece(f.url, f.up).then((mesh) => {
        if (mesh && live) bump((n) => n + 1);
      });
    return () => {
      live = false;
    };
  }, [wanted]);
}

/** The piece at `url` once it has loaded (undefined until then, and for a file that does not read). */
export function usePiece(url: string | undefined, up: 'y' | 'z' = 'y'): MeshData | undefined {
  useArrival(url ? [{ url, up }] : []);
  return url ? peekPiece(url, up) : undefined;
}

/** Several pieces at once (a table's seats): the meshes that have loaded, by id. */
export function usePieces(
  files: Readonly<Record<string, { url: string; up?: 'y' | 'z' } | undefined>>,
): Readonly<Record<string, MeshData>> {
  const list = Object.entries(files).flatMap(([id, f]) =>
    f ? [{ id, url: f.url, up: f.up ?? 'y' }] : [],
  );
  useArrival(list);
  const out: Record<string, MeshData> = {};
  for (const f of list) {
    const mesh = peekPiece(f.url, f.up);
    if (mesh) out[f.id] = mesh;
  }
  return out;
}
