// Closed-form motion curves for JS-driven motion: a damped spring to a fixed target, and CSS cubic-bezier easings.
// Pure: no React, no clock, no state; the caller passes the time in. A goal that moves stays on stepSpring
// (table3d/smooth.ts). The guards, the settling bound and the tests are in docs/sdk/curves.md.
// Sources: W3C, CSS Easing Functions Level 1, sections 2.2 and 2.2.1 (cubic-bezier, the named keywords):
//   https://www.w3.org/TR/css-easing-1/
// MIT OpenCourseWare 18.03SC, Under, Over and Critical Damping (the three cases of the damped oscillator):
//   https://ocw.mit.edu/courses/18-03sc-differential-equations-fall-2011/7e212064ad281d00e1dac893b1f722a7_MIT18_03SCF11_s13_2text.pdf
// The formulas are derived for this file from those facts (B18 of partybox-gpt-drops, PR #5); no library code is copied.

/** The largest finite double: the saturation bound of every output, and settleTime's "no finite bound" sentinel. */
const LIMIT = Number.MAX_VALUE;

/**
 * Keeps every output finite: NaN becomes 0 and ±Infinity saturate to ±Number.MAX_VALUE. This guards the output only:
 * an intermediate that overflowed does not make the motion accurate (docs/sdk/curves.md, Guards).
 */
function finiteOutput(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(-LIMIT, Math.min(LIMIT, n));
}

/**
 * The state of the spring `mass·x'' + damping·x' + stiffness·x = 0` after `t` seconds, from displacement `x0` (default 1)
 * and velocity `v0` (default 0), about the equilibrium 0: `[displacement, velocity]`. Time is in seconds and velocity in
 * displacement units per second. Each call is independent: there is no state to step.
 *
 * Guards: a mass that is not positive, or a stiffness or damping below zero, disables the spring and returns `[0, 0]`,
 * even at t = 0. For a valid spring, t ≤ 0 returns the start. Zero stiffness and zero damping give a free particle; a
 * zero-mass spring is never read as a small one. A critically damped spring (damping² = 4·mass·stiffness) or an
 * overdamped one has no overshoot from rest.
 */
export function spring(
  t: number,
  mass: number,
  stiffness: number,
  damping: number,
  x0 = 1,
  v0 = 0,
): [number, number] {
  if (!(mass > 0 && stiffness >= 0 && damping >= 0)) return [0, 0];
  if (t <= 0) return [finiteOutput(x0), finiteOutput(v0)];
  // In the form x'' + 2·decay·x' + omegaSquared·x = 0.
  const decay = damping / mass / 2;
  const omegaSquared = stiffness / mass;
  const discriminant = decay * decay - omegaSquared;
  const q = Math.sqrt(Math.abs(discriminant));
  if (discriminant > 0) {
    // Overdamped: two real roots. The slow one is a quotient, so no two nearly equal roots are subtracted.
    const slow = -omegaSquared / (decay + q);
    const e = Math.exp(slow * t);
    // With the fast root −(decay + q): S = (e^(slow·t) − e^(fast·t)) / 2q and S' = slow·S + e^(fast·t).
    const s = (e * -Math.expm1(-2 * q * t)) / (2 * q);
    const z = v0 - slow * x0;
    return [
      finiteOutput(x0 * e + z * s),
      finiteOutput(slow * x0 * e + z * (slow * s + Math.exp(-(decay + q) * t))),
    ];
  }
  // Underdamped or critical: x = e^(−decay·t)·(x0·cos(q·t) + (v0 + decay·x0)·sin(q·t)/q). At q = 0 the sine term is t.
  const envelope = Math.exp(-decay * t);
  const cosTerm = envelope * Math.cos(q * t);
  const sinTerm = envelope * (q ? Math.sin(q * t) / q : t);
  return [
    finiteOutput(x0 * cosTerm + (v0 + decay * x0) * sinTerm),
    finiteOutput(v0 * cosTerm - (decay * v0 + omegaSquared * x0) * sinTerm),
  ];
}

/**
 * A conservative time in seconds after which the spring's displacement and velocity stay within `epsilon` for every later
 * time, each measured in its own units. It is a bound, not the first crossing or the exact minimum: it favours not
 * stopping early. Zero for a disabled spring or an exactly zero start.
 *
 * Number.MAX_VALUE is a sentinel for "no finite bound was supplied": a zero or negative tolerance, a zero stiffness or
 * damping, or an unrepresentable bound. It is NOT a duration. Map it to undefined before any timer or deadline. Some
 * zero-stiffness cases already rest; the sentinel does not claim that a trajectory can never get within tolerance.
 *
 * The bound: with a = damping/(2·mass), w = stiffness/mass, rho = a when not overdamped and rho = w/(a + √(a² − w))
 * when overdamped, B = max(|v0 + a·x0|, |a·v0 + w·x0|), C = max(|x0|, |v0|) + 2·B/(e·rho), the time is
 * max(0, (2/rho)·(ln C − ln epsilon)). Both quantities decay like (A + B·t)·e^(−rho·t), so each stays under C·e^(−rho·t/2).
 */
export function settleTime(
  mass: number,
  stiffness: number,
  damping: number,
  x0 = 1,
  v0 = 0,
  epsilon = 0.001,
): number {
  if (!(mass > 0 && stiffness >= 0 && damping >= 0) || (x0 === 0 && v0 === 0)) return 0;
  const decay = damping / mass / 2;
  const omegaSquared = stiffness / mass;
  const rho =
    decay * decay > omegaSquared
      ? omegaSquared / (decay + Math.sqrt(decay * decay - omegaSquared))
      : decay;
  const start = Math.max(Math.abs(x0), Math.abs(v0));
  const motion = Math.max(Math.abs(v0 + decay * x0), Math.abs(decay * v0 + omegaSquared * x0));
  const bound = Math.max(
    0,
    (2 / rho) * (Math.log(start + (2 * motion) / (Math.E * rho)) - Math.log(epsilon)),
  );
  return stiffness > 0 && damping > 0 && epsilon > 0 && Number.isFinite(bound) ? bound : LIMIT;
}

/** One coordinate of a cubic Bézier that starts at 0, ends at 1 and has inner control values `c1` and `c2`, at `u`. */
function bezier(u: number, c1: number, c2: number): number {
  return 3 * u * (1 - u) * (1 - u) * c1 + 3 * u * u * (1 - u) * c2 + u * u * u;
}

/**
 * x(u) − progress, for the curve whose x coordinate is bezier(u, x1, x2). Near the middle it is a polynomial centred on
 * u = ½: the nearly flat interior (x1 = 1, x2 = 0) would lose its tiny residual subtracting two numbers close to one half.
 */
function xResidual(u: number, x1: number, x2: number, progress: number): number {
  if (u < 0.25) return bezier(u, x1, x2) - progress;
  // By the symmetry of the curve, x(u) = 1 − bezier(1 − u, 1 − x2, 1 − x1).
  if (u > 0.75) return 1 - progress - bezier(1 - u, 1 - x2, 1 - x1);
  const c = u - 0.5;
  return (
    (((1 + 3 * (x1 - x2)) * c + 1.5 * (1 - x1 - x2)) * c + 0.75 * (1 - x1 + x2)) * c +
    (0.5 - progress) +
    0.375 * (x1 - 1 + x2)
  );
}

/**
 * The value of the CSS `cubic-bezier(x1, y1, x2, y2)` easing at `progress`: the curve's y where its x equals `progress`.
 *
 * Guards: x controls must lie in [0, 1]; CSS would reject other values, and this numeric form returns the identity
 * instead. Y controls are not clamped, so overshoot is kept. Progress 0 and 1 are exact. Outside [0, 1] the curve goes on
 * along an end tangent, as CSS says: from (x1, y1), or else (x2, y2), at the start; toward (x2, y2), or else (x1, y1), at
 * the end. A tangent with no direction is flat.
 */
export function cubicBezier(
  progress: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  if (!(x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1) || progress === 0 || progress === 1) {
    return finiteOutput(progress);
  }
  if (progress < 0) {
    const startSlope = x1 > 0 ? y1 / x1 : x2 > 0 ? y2 / x2 : 0;
    return finiteOutput(progress * startSlope);
  }
  if (progress > 1) {
    const endSlope = x2 < 1 ? (1 - y2) / (1 - x2) : x1 < 1 ? (1 - y1) / (1 - x1) : 0;
    return finiteOutput(1 + (progress - 1) * endSlope);
  }
  // Solve x(u) = progress on a bracket [low, high]: up to 8 safeguarded Newton steps, then bisection; 64 iterations.
  let low = 0;
  let high = 1;
  let u = progress;
  for (let i = 0; i < 64; i++) {
    const residual = xResidual(u, x1, x2, progress);
    if (residual > 0) high = u;
    else low = u;
    const xSlope = 3 * ((1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * (x2 - x1) + u * u * (1 - x2));
    const newton = u - residual / xSlope;
    u = i < 8 && newton > low && newton < high ? newton : (low + high) / 2;
  }
  return finiteOutput(bezier(u, y1, y2));
}

/** An easing: progress in, eased value out (0 maps to 0 and 1 to 1 for the four keywords). */
export type Easing = (progress: number) => number;
/** The keyword names of `easings`. */
export type EasingName = 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** The four CSS keyword easings, with the control points of W3C CSS Easing Level 1, section 2.2.1. */
export const easings: Readonly<Record<EasingName, Easing>> = {
  ease: (progress) => cubicBezier(progress, 0.25, 0.1, 0.25, 1),
  'ease-in': (progress) => cubicBezier(progress, 0.42, 0, 1, 1),
  'ease-out': (progress) => cubicBezier(progress, 0, 0, 0.58, 1),
  'ease-in-out': (progress) => cubicBezier(progress, 0.42, 0, 0.58, 1),
};
