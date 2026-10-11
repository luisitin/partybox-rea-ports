// The fixed cases of the B18 suite (partybox-gpt-drops PR #5, tests/regressions.mjs lines 18-65), as vitest. The two
// reference algorithms at the end are the B18 ones, kept here as test-only checks: production imports nothing from them.
//
// Mistake checklist: B18's 25 mutations (regressions.mjs M01-M25). They were NOT run here (no mutation runner). Each line
// names the area below whose cases should fail on that mistake; that was checked by reading, not by running.
//   M01 accept zero mass (>= for >)                      spring: disabled
//   M02 accept negative stiffness                        spring: disabled
//   M03 omit the division by mass                        spring: closed forms (mass normalization)
//   M04 lose the initial velocity at t <= 0              spring: holds the initial state
//   M05 double the decay (c/m instead of c/(2m))         spring: closed forms
//   M06 wrong discriminant sign                          spring: closed forms
//   M07 treat underdamping as critical                   spring: closed forms
//   M08 exponential growth instead of decay              spring: closed forms
//   M09 omit the sine's divisor q                        spring: closed forms
//   M10 wrong restoring-force sign in the velocity       spring: closed forms
//   M11 critical limit without t                         spring: closed forms
//   M12 fast root instead of slow root                   spring: closed forms
//   M13 wrong expm1 sign                                 spring: closed forms
//   M14 overdamped root gap halved                       spring: closed forms
//   M15 wrong overdamped initial coefficient             spring: closed forms
//   M16 no finite-output guard                           spring: saturates overflowing outputs
//   M17 drop the settling envelope                       settleTime: matches the bisection reference
//   M18 decay rate instead of the slow settling rate     settleTime: matches the bisection reference
//   M19 halve the settling bound (2/rho -> 1/rho)        settleTime: matches the bisection reference
//   M20 either zero (not both) read as a zero start      settleTime: matches the bisection reference
//   M21 Bézier evaluated at progress, not at the root    cubicBezier: inverts x
//   M22 too few solver iterations                        cubicBezier: converges from a nearly flat start
//   M23 lose the start's secondary tangent               cubicBezier: extrapolates before 0
//   M24 lose the end's secondary tangent                 cubicBezier: extrapolates after 1
//   M25 wrong named ease-in control point                easings: named CSS keywords
import { describe, expect, it } from 'vitest';
import { cubicBezier, easings, settleTime, spring } from './curves';
import type { EasingName } from './curves';

const MAX = Number.MAX_VALUE;

/** Each entry of `actual` is within `tolerance` of its `expected` (exact when the tolerance is 0). */
function near(actual: number | number[], expected: number | number[], tolerance = 1e-10): void {
  const got = Array.isArray(actual) ? actual : [actual];
  const want = Array.isArray(expected) ? expected : [expected];
  expect(got).toHaveLength(want.length);
  got.forEach((value, i) => {
    expect(Number.isFinite(value)).toBe(true);
    expect(Math.abs(value - want[i]!)).toBeLessThanOrEqual(tolerance);
  });
}

/** Both outputs are finite numbers (the saturation guard). */
function finite(actual: number[]): void {
  expect(actual.every(Number.isFinite)).toBe(true);
}

describe('spring: the published closed forms', () => {
  it.each([0, 0.1, 0.5, 1, 5, 1 / 7])('under, critical and over damping at t = %s', (t) => {
    const e = Math.exp(-t);
    const e2 = Math.exp(-2 * t);
    const e3 = Math.exp(-3 * t);
    near(spring(t, 1, 5, 2), [
      e * (Math.cos(2 * t) + Math.sin(2 * t) / 2),
      -2.5 * e * Math.sin(2 * t),
    ]);
    near(spring(t, 1, 4, 4), [(1 + 2 * t) * e2, -4 * t * e2]);
    near(spring(t, 1, 3, 4), [1.5 * e - 0.5 * e3, -1.5 * e + 1.5 * e3]);
    near(spring(t, 2, 10, 4), spring(t, 1, 5, 2));
  });

  it('agrees with the matrix exponential for independent initial conditions', () => {
    for (const [m, k, c, x, v] of [
      [1, 9, 1, -2, 3],
      [1, 4, 4, 0.2, -7],
      [2, 6, 8, -1, 3],
      [3, 0, 0, 4, 2],
      [1, 0, 2, 3, 4],
    ]) {
      near(spring(0.4, m!, k!, c!, x!, v!), matrixSpring(0.4, m!, k!, c!, x!, v!));
    }
  });

  it('is disabled by a zero mass, at t = 0 and after it', () => {
    near(spring(0, 0, 4, 4, 7, 3), [0, 0]);
    near(spring(1, 0, 4, 4, 7, 3), [0, 0]);
  });

  it('is disabled by a negative mass, stiffness or damping', () => {
    near(spring(1, -1, 4, 4), [0, 0]);
    near(spring(1, 1, -4, 4), [0, 0]);
    near(spring(1, 1, 4, -4), [0, 0]);
  });

  it('holds the initial state for a time before the start', () => {
    near(spring(-1, 1, 5, 2, 3, 7), [3, 7]);
  });

  it('moves a free particle at constant velocity, with and without viscous drag', () => {
    near(spring(2, 2, 0, 0, 3, 4), [11, 4]);
    near(spring(1, 1, 0, 2, 3, 4), [3 + 2 * (1 - Math.exp(-2)), 4 * Math.exp(-2)]);
  });

  it('saturates overflowing outputs and keeps extreme intermediates finite', () => {
    finite(spring(2, 1, 0, 0, MAX, MAX));
    finite(spring(MAX, Number.MIN_VALUE, MAX, MAX, MAX, MAX));
  });
});

describe('cubicBezier: the CSS curve', () => {
  it('extrapolates before 0 along the start tangent (primary, secondary, absent)', () => {
    near(cubicBezier(-0.5, 0.25, 1, 0.8, 0.3), -2);
    near(cubicBezier(-0.5, 0, 7, 0.5, 2), -2);
    near(cubicBezier(-0.5, 0, 7, 0, 2), 0);
  });

  it('extrapolates after 1 along the end tangent (primary, secondary, absent)', () => {
    near(cubicBezier(1.5, 0.2, 0, 0.5, 0.75), 1.25);
    near(cubicBezier(1.5, 0.4, 0.1, 1, 5), 1.75);
    near(cubicBezier(1.5, 1, 0, 1, 0), 1);
  });

  it('is exact at the endpoints', () => {
    near(cubicBezier(0, 0, 2, 0, 3), 0, 0);
    near(cubicBezier(1, 1, 2, 1, 3), 1, 0);
  });

  it('falls back to the identity for invalid x controls', () => {
    near(cubicBezier(0.3, -1, 2, 0.5, 3), 0.3, 0);
  });

  it('inverts x to find the curve parameter, instead of evaluating at the progress', () => {
    near(cubicBezier(0.001, 0, 1, 0, 1), 0.271);
  });

  it('converges from a nearly flat start', () => {
    near(cubicBezier(1e-12, 0, 1, 0, 1), 0.000299970001);
  });

  it('keeps the tiny residual of a nearly flat interior', () => {
    for (const p of [0.5 - 2 ** -53, 0.5, 0.5 + 2 ** -53]) {
      const t = 0.5 + Math.cbrt((p - 0.5) / 4);
      near(cubicBezier(p, 1, 0, 0, 1), 3 * t * t - 2 * t * t * t);
    }
  });

  it('saturates an extrapolation with huge inputs', () => {
    finite([cubicBezier(-MAX, Number.MIN_VALUE, MAX, 0.5, 0)]);
  });
});

describe('easings: the named CSS keywords', () => {
  const named: [EasingName, [number, number, number, number]][] = [
    ['ease', [0.25, 0.1, 0.25, 1]],
    ['ease-in', [0.42, 0, 1, 1]],
    ['ease-out', [0, 0, 0.58, 1]],
    ['ease-in-out', [0.42, 0, 0.58, 1]],
  ];
  it.each(named)('%s is cubic-bezier with its control points', (name, [x1, y1, x2, y2]) => {
    for (const t of [-1, 0.25, 0.5, 1, 2]) near(easings[name](t), cubicBezier(t, x1, y1, x2, y2));
  });
});

describe('settleTime: a conservative bound and its sentinel', () => {
  it('matches the bisection reference in under, critical and over damping, and with velocity', () => {
    for (const [m, k, c, x, v] of [
      [1, 5, 2, 1, 0],
      [1, 4, 4, 1, 0],
      [1, 3, 4, 1, 0],
      [2, 6, 8, -2, 3],
      [1, 1, 2, 0, 2],
    ]) {
      near(settleTime(m!, k!, c!, x!, v!), referenceSettle(m!, k!, c!, x!, v!));
    }
  });

  it('is zero for a stationary spring', () => {
    near(settleTime(1, 4, 4, 0, 0), 0, 0);
  });

  it('returns the sentinel with no finite bound: undamped, unsprung, or a zero or negative tolerance', () => {
    near(settleTime(1, 4, 0), MAX, 0);
    near(settleTime(1, 0, 2), MAX, 0);
    near(settleTime(1, 4, 4, 1, 0, 0), MAX, 0);
    near(settleTime(1, 4, 4, 1, 0, -1), MAX, 0);
  });

  it('is zero for a disabled spring', () => {
    near(settleTime(0, 4, 4), 0, 0);
  });

  it('stays finite with extreme intermediates', () => {
    finite([settleTime(Number.MIN_VALUE, MAX, MAX, MAX, MAX, Number.MIN_VALUE)]);
  });
});

// ── test-only reference algorithms (B18 tests/reference.ts), not exported ───────────────────────

type State = [number, number];
type Matrix = [number, number, number, number];

function product(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
  ];
}

/** exp(t·A) by a Taylor series with scaling and squaring: a second algorithm for the spring's state. */
function matrixSpring(
  t: number,
  mass: number,
  stiffness: number,
  damping: number,
  x = 1,
  v = 0,
): State {
  if (mass <= 0 || stiffness < 0 || damping < 0) return [0, 0];
  if (t <= 0) return [x, v];
  const norm = t * Math.max(1, (stiffness + damping) / mass);
  const squares = Math.max(0, Math.ceil(Math.log2(norm / 0.25)));
  const dt = t / 2 ** squares;
  const a: Matrix = [0, dt, (-dt * stiffness) / mass, (-dt * damping) / mass];
  let total: Matrix = [1, 0, 0, 1];
  let term: Matrix = [1, 0, 0, 1];
  for (let n = 1; n <= 24; n++) {
    term = product(term, a).map((value) => value / n) as Matrix;
    total = total.map((value, i) => value + term[i]!) as Matrix;
  }
  for (let i = 0; i < squares; i++) total = product(total, total);
  return [total[0] * x + total[1] * v, total[2] * x + total[3] * v];
}

/** The same bound as settleTime, found by bisection on the exponential rather than by inverting the logarithm. */
function referenceSettle(
  mass: number,
  stiffness: number,
  damping: number,
  x = 1,
  v = 0,
  epsilon = 0.001,
): number {
  if (mass <= 0 || stiffness < 0 || damping < 0 || (x === 0 && v === 0)) return 0;
  if (stiffness === 0 || damping === 0 || epsilon <= 0) return MAX;
  const halfDrag = damping / (2 * mass);
  const omegaSquared = stiffness / mass;
  const discriminant = halfDrag * halfDrag - omegaSquared;
  const rate = discriminant <= 0 ? halfDrag : omegaSquared / (halfDrag + Math.sqrt(discriminant));
  const first = Math.max(Math.abs(x), Math.abs(v));
  const second = Math.max(Math.abs(v + halfDrag * x), Math.abs(halfDrag * v + omegaSquared * x));
  const coefficient = first + (second * (2 / Math.E)) / rate;
  if (coefficient <= epsilon) return 0;
  let low = 0;
  let high = 1;
  while (coefficient * Math.exp((-rate * high) / 2) > epsilon && Number.isFinite(high)) high *= 2;
  if (!Number.isFinite(high)) return MAX;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (coefficient * Math.exp((-rate * mid) / 2) > epsilon) low = mid;
    else high = mid;
  }
  return high;
}
