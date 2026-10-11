// Just enough quaternion and vector maths for dice: pure, no three, so the roll can be baked and tested without WebGL.
export type Vec3 = readonly [number, number, number];
/** x, y, z, w. */
export type Quat = readonly [number, number, number, number];

export const IDENTITY: Quat = [0, 0, 0, 1];

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const normalize = (v: Vec3): Vec3 => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

export function qMul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
export const qConj = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];
export function qNormalize(q: Quat): Quat {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}
export function qFromAxisAngle(axis: Vec3, angle: number): Quat {
  const [x, y, z] = normalize(axis),
    s = Math.sin(angle / 2);
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}
/** Rotates `v` by `q`. */
export function qRotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]],
    k = cross(u, v),
    t: Vec3 = [2 * k[0], 2 * k[1], 2 * k[2]],
    c = cross(u, t);
  return [v[0] + q[3] * t[0] + c[0], v[1] + q[3] * t[1] + c[1], v[2] + q[3] * t[2] + c[2]];
}
/** The shortest rotation taking unit vector `a` to unit vector `b`; a half turn about a cube axis when they oppose. */
export function qFromTo(a: Vec3, b: Vec3): Quat {
  const d = dot(a, b);
  if (d > 1 - 1e-9) return IDENTITY;
  if (d < -1 + 1e-9) {
    const e: Vec3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return qFromAxisAngle(cross(a, e), Math.PI);
  }
  return qFromAxisAngle(cross(a, b), Math.acos(Math.max(-1, Math.min(1, d))));
}
/** Spherical interpolation, the short way round. */
export function qSlerp(a: Quat, b: Quat, t: number): Quat {
  let bx = b[0],
    by = b[1],
    bz = b[2],
    bw = b[3];
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (cos > 0.9995)
    return qNormalize([
      a[0] + (bx - a[0]) * t,
      a[1] + (by - a[1]) * t,
      a[2] + (bz - a[2]) * t,
      a[3] + (bw - a[3]) * t,
    ]);
  const theta = Math.acos(cos),
    sin = Math.sin(theta),
    wa = Math.sin((1 - t) * theta) / sin,
    wb = Math.sin(t * theta) / sin;
  return [wa * a[0] + wb * bx, wa * a[1] + wb * by, wa * a[2] + wb * bz, wa * a[3] + wb * bw];
}
