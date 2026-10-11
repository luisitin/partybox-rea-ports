import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2, Vector3 } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { validPoint } from './project';
import type { MeshData, Point3 } from './types';

/** Newell's normal uses every edge, including concave caps with collinear starting edges. */
function faceNormal(points: readonly Point3[]): Vector3 {
  const normal = new Vector3();
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!;
    normal.x += (a[1] - b[1]) * (a[2] + b[2]);
    normal.y += (a[2] - b[2]) * (a[0] + b[0]);
    normal.z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return normal;
}

/** Planar face ear-clipping, grouped by material: at most three draw calls for one solid. */
export function solidGeometry(mesh: MeshData, crease = 0): BufferGeometry {
  const buckets: number[][] = [[], [], []];
  for (const face of mesh) {
    if (face.points.length < 3 || !face.points.every(validPoint)) continue;
    const normal = faceNormal(face.points);
    if (normal.lengthSq() <= 1e-20) continue;
    const axis =
      Math.abs(normal.x) >= Math.abs(normal.y) && Math.abs(normal.x) >= Math.abs(normal.z)
        ? 0
        : Math.abs(normal.y) >= Math.abs(normal.z)
          ? 1
          : 2;
    const contour = face.points.map((point) =>
      axis === 0
        ? new Vector2(point[1], point[2])
        : axis === 1
          ? new Vector2(point[0], point[2])
          : new Vector2(point[0], point[1]),
    );
    const bucket = buckets[face.material === 'dark' ? 1 : face.material === 'bright' ? 2 : 0]!;
    for (const triangle of ShapeUtils.triangulateShape(contour, [])) {
      const a = face.points[triangle[0]!]!,
        b = face.points[triangle[1]!]!,
        c = face.points[triangle[2]!]!;
      const cross = new Vector3(...b)
        .sub(new Vector3(...a))
        .cross(new Vector3(...c).sub(new Vector3(...a)));
      if (cross.lengthSq() <= 1e-20) continue;
      // Dominant-plane projection can reverse orientation; preserve the original face normal.
      bucket.push(...a, ...(cross.dot(normal) > 0 ? b : c), ...(cross.dot(normal) > 0 ? c : b));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(buckets.flat(), 3));
  let start = 0;
  for (const [material, bucket] of buckets.entries()) {
    const count = bucket.length / 3;
    if (count > 0) geometry.addGroup(start, count, material);
    start += count;
  }
  geometry.computeVertexNormals();
  // Non-indexed: smoothing rewrites the normals in place and keeps the material groups.
  if (crease > 0 && buckets.some((bucket) => bucket.length > 0)) toCreasedNormals(geometry, crease);
  geometry.computeBoundingSphere();
  return geometry;
}
