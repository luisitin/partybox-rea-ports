// Back-face rejection keeps far-side windows behind their building instead of floating over roofs.
import type { Camera, Face } from './scene';
export function facingCamera(face: Face, camera: Camera): boolean {
  const a = face.points[0],
    b = face.points[1],
    c = face.points[2];
  if (!a || !b || !c) return false;
  const ux = b.x - a.x,
    uy = b.y - a.y,
    uz = b.z - a.z,
    vx = c.x - a.x,
    vy = c.y - a.y,
    vz = c.z - a.z;
  const nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  const ex = camera.x + camera.depth * 0.82 * 0.12,
    ey = camera.y + camera.depth * 0.82,
    ez = camera.depth * 0.72;
  return nx * (ex - a.x) + ny * (ey - a.y) + nz * (ez - a.z) > 0;
}
