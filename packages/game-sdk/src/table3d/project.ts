// Three's affine/vector math supplies the SVG fallback and small identity thumbnails.
// Composition adapted from the prior seen.js port (Apache-2.0); see SOURCES.md/license.
// The camera/light values preserve the existing PartyBox tokens' 96×96 composition.
import { Matrix4 } from 'three/src/math/Matrix4.js';
import { Vector3 } from 'three/src/math/Vector3.js';
import type { MeshData, Point3, ProjectedSolidFace } from './types';

export function validPoint(point: Point3): boolean {
  return point.length === 3 && point.every(Number.isFinite);
}

export function projectSolid(mesh: MeshData, yaw = -0.48): ProjectedSolidFace[] {
  const angle = Number.isFinite(yaw) ? yaw : -0.48;
  const cy = Math.cos(angle),
    sy = Math.sin(angle),
    cp = Math.cos(0.34),
    sp = Math.sin(0.34);
  const camera = new Matrix4().set(
    cy,
    0,
    sy,
    0,
    -sp * sy,
    -cp,
    sp * cy,
    0,
    cp * sy,
    -sp,
    -cp * cy,
    0,
    0,
    0,
    0,
    1,
  );
  const transformed = mesh
    .filter((face) => face.points.length >= 3 && face.points.every(validPoint))
    .map((face) => ({
      ...face,
      vertices: face.points.map((point) => new Vector3(...point).applyMatrix4(camera)),
    }));
  const points = transformed.flatMap((face) => face.vertices);
  if (points.length === 0) return [];
  const x0 = Math.min(...points.map((point) => point.x));
  const x1 = Math.max(...points.map((point) => point.x));
  const y0 = Math.min(...points.map((point) => point.y));
  const y1 = Math.max(...points.map((point) => point.y));
  const factor = Math.min(78 / Math.max(x1 - x0, 1e-9), 76 / Math.max(y1 - y0, 1e-9));
  const light = new Vector3(-0.5, -0.8, -1).normalize();
  const surfaces: ProjectedSolidFace[] = [];
  for (const face of transformed) {
    const first = face.vertices[0]!;
    const normal = face.vertices[1]!.clone()
      .sub(first)
      .cross(face.vertices[face.vertices.length - 1]!.clone().sub(first))
      .normalize();
    if (normal.z >= -0.00001) continue;
    const diffuse = Math.max(0, light.dot(normal));
    const reflected = normal
      .clone()
      .multiplyScalar(diffuse * 2)
      .sub(light);
    const specular = Math.pow(Math.max(0, -reflected.z), 18);
    surfaces.push({
      points: face.vertices
        .map(
          (point) =>
            `${(48 + (point.x - (x0 + x1) / 2) * factor).toFixed(2)},${(46 + (point.y - (y0 + y1) / 2) * factor).toFixed(2)}`,
        )
        .join(' '),
      depth: face.vertices.reduce((sum, point) => sum + point.z, 0) / face.vertices.length,
      shade: Math.min(1.55, 0.38 + diffuse * 0.72 + specular * 0.45),
      ...(face.material ? { material: face.material } : {}),
    });
  }
  return surfaces.sort((a, b) => b.depth - a.depth);
}
