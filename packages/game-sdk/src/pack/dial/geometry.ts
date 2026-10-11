// Pure geometry for the Dial (P00 §6): positions 0–100 on a semicircle, the target's scoring
// wedges clipped at both ends, and the throttle a huddle drag sends through. No React, no DOM.

/** The dial's drawing box (SVG viewBox units): the pivot sits low, the face is a half disc. */
export const BOX = { w: 1000, h: 560, cx: 500, cy: 520, face: 430, rim: 462 } as const;

/** 0 → the left end (180°), 100 → the right end (0°); degrees, counter-clockwise from the right. */
export function posToDeg(pos: number): number {
  return 180 - (Math.min(100, Math.max(0, pos)) * 180) / 100;
}

export function pointAt(pos: number, radius: number): { x: number; y: number } {
  const rad = (posToDeg(pos) * Math.PI) / 180;
  return { x: BOX.cx + radius * Math.cos(rad), y: BOX.cy - radius * Math.sin(rad) };
}

/** A pie slice from the pivot between two positions (from < to), as an SVG path. */
export function slicePath(from: number, to: number, radius: number): string {
  const a = pointAt(from, radius);
  const b = pointAt(to, radius);
  const large = Math.abs(to - from) > 100 ? 1 : 0;
  const f = (n: number): string => n.toFixed(2);
  return `M ${BOX.cx} ${BOX.cy} L ${f(a.x)} ${f(a.y)} A ${radius} ${radius} 0 ${large} 1 ${f(b.x)} ${f(b.y)} Z`;
}

export interface Wedge {
  from: number;
  to: number;
  pts: 2 | 3 | 4;
  /** Where the number sits (the wedge's middle), or null when the wedge is too thin to print. */
  label: number | null;
}

/** The five wedges 2 · 3 · 4 · 3 · 2 around `target`, clipped at 0 and 100 (spec §5.5). `bands`
 *  are the 4 / 3 / 2 edges (normal: 5, 10, 15). A wedge clipped to nothing is dropped. */
export function wedges(target: number, bands: readonly [number, number, number]): Wedge[] {
  const [four, three, two] = bands;
  const raw: { from: number; to: number; pts: 2 | 3 | 4 }[] = [
    { from: target - two, to: target - three, pts: 2 },
    { from: target - three, to: target - four, pts: 3 },
    { from: target - four, to: target + four, pts: 4 },
    { from: target + four, to: target + three, pts: 3 },
    { from: target + three, to: target + two, pts: 2 },
  ];
  return raw
    .map((w) => ({ ...w, from: Math.max(0, w.from), to: Math.min(100, w.to) }))
    .filter((w) => w.to - w.from > 0.01)
    .map((w) => ({ ...w, label: w.to - w.from >= 2.5 ? (w.from + w.to) / 2 : null }));
}

/** Where the reveal's faces ride for a dial drawn `boxPx` wide. Faces are a fixed `facePx`, so on
 *  a smaller dial (a 720p TV, the phone stage) a face covers more of the dial: the distances here
 *  follow the drawn size. `rim`: a face's distance from the pivot when it sits on the rim; `step`:
 *  a face and its air, in box units. Unmeasured (`boxPx` 0) reads as a 1080p TV. */
export interface FaceLayout {
  rim: number;
  step: number;
}

export function faceLayout(boxPx: number, facePx = 40): FaceLayout {
  const unitPx = boxPx > 0 ? boxPx / BOX.w : 0.9;
  return {
    rim: BOX.rim + Math.max(34, (facePx / 2 + 6) / unitPx),
    step: Math.max(46, (facePx + 6) / unitPx),
  };
}

/** A face's place on the reveal: its centre in box units, the value it is drawn at (its own, unless
 *  a crowd slid it along the rim), and how many steps it moved along that spoke (0: on the rim;
 *  above 0 outwards, below 0 in over the dial face). */
export interface Spoke {
  x: number;
  y: number;
  at: number;
  step: number;
}

export interface SpokeOptions {
  /** Steps outwards a face may take (default 4). */
  maxOut?: number;
  /** The values a face may slide to when its own spoke is full: the span of the number it scored,
   *  so a slide never draws it over another one (default: its own value only). */
  range?: (pos: number) => readonly [number, number];
  /** How far a face may slide along the rim, in positions (default 6). */
  maxSlide?: number;
}

/** The reveal's faces (spec §5.5, "faces stack outwards where they overlap"): each face rides its
 *  own spoke, the line from the pivot through its true value, so it sits over the number its dial
 *  scored, where the phone's strip puts it too (T-0162: fanning a crowd along the rim drew +4
 *  faces beside a 2 wedge, up to 14 positions off). In the given order, a face that would touch
 *  one already placed steps out along its spoke, a face at a time, up to `maxOut` steps, as long as
 *  it stays within the dial's width (past it, at the ends, lie the end labels); then in along the
 *  spoke, over the dial face. A spoke that is full slides the face along the rim a little at a
 *  time, within `range` and `maxSlide` (a big crowd on a 720p dial, review F1), trying each spoke
 *  on the way the same way. With no room anywhere, it takes the place where it overlaps least. */
export function spokes(
  pos: readonly number[],
  layout: FaceLayout,
  opts: SpokeOptions = {},
): Spoke[] {
  const { maxOut = 4, range = (p: number) => [p, p] as const, maxSlide = 6 } = opts;
  const placed: Spoke[] = [];
  const half = layout.step / 2;
  const room = (x: number, y: number): number =>
    Math.min(Infinity, ...placed.map((o) => Math.hypot(o.x - x, o.y - y)));
  // Out while the face's centre stays over the dial's width and the face within a tenth of the
  // dial's height above it: higher, a crowd at the top ran into the clue above (review F1).
  const fits = (x: number, y: number): boolean => x >= 0 && x <= BOX.w && y - half >= -BOX.h * 0.1;
  const inward = Math.max(0, Math.floor((layout.rim - BOX.face * 0.4) / layout.step));
  const steps = [
    0,
    ...Array.from({ length: maxOut }, (_, k) => k + 1),
    ...Array.from({ length: inward }, (_, k) => -(k + 1)),
  ];
  for (const p of pos) {
    const [lo, hi] = range(p);
    // its own spoke first, then half a position further each way, inside its number's span
    const slides = [0];
    for (let d = 0.5; d <= maxSlide + 1e-9; d += 0.5) {
      if (p + d <= Math.min(hi, 100) + 1e-9) slides.push(d);
      if (p - d >= Math.max(lo, 0) - 1e-9) slides.push(-d);
    }
    let best: Spoke & { room: number } = { ...pointAt(p, layout.rim), at: p, step: 0, room: -Infinity }; // prettier-ignore
    search: for (const d of slides)
      for (const step of steps) {
        const { x, y } = pointAt(p + d, layout.rim + step * layout.step);
        if ((step !== 0 || d !== 0) && !fits(x, y)) continue;
        const r = room(x, y);
        if (r >= layout.step - 1e-6) {
          best = { x, y, at: p + d, step, room: r };
          break search;
        }
        if (r > best.room) best = { x, y, at: p + d, step, room: r };
      }
    placed.push({ x: best.x, y: best.y, at: best.at, step: best.step });
  }
  return placed;
}

/** Markers that sit within `gap` of an earlier one stack one ring further out (spec §5.5). */
export function stackRings(positions: readonly number[], gap = 4): number[] {
  const rings: number[] = [];
  positions.forEach((pos) => {
    // The lowest ring where no earlier face is within `gap` (a clash met out of order was missed).
    let ring = 0;
    const clash = (r: number): boolean =>
      rings.some((rj, j) => rj === r && Math.abs((positions[j] as number) - pos) < gap);
    while (clash(ring)) ring += 1;
    rings.push(ring);
  });
  return rings;
}

/** Where a pointer at (x, y) lands on the semicircle, as 0–100: the angle round the pivot (box
 *  units, y down), the inverse of `posToDeg`. A point below the pivot snaps to the nearer end. */
export function posFromPoint(x: number, y: number): number {
  const dx = x - BOX.cx;
  const dy = BOX.cy - y;
  if (dy <= 0) return dx < 0 ? 0 : dx > 0 ? 100 : 50;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Math.round(Math.min(100, Math.max(0, ((180 - deg) * 100) / 180)));
}

/** Where a pointer at `x` lands on a track from `left` to `left + width`, as 0–100. */
export function posFromX(x: number, left: number, width: number): number {
  if (width <= 0) return 50;
  return Math.round(Math.min(100, Math.max(0, ((x - left) / width) * 100)));
}

/**
 * A leading-edge throttle for a drag (spec §5.9): at most one value per `intervalMs`, the latest
 * value delivered at the end of each window, and `flush` sends what is pending on release.
 * `now` and `schedule` are injected so tests drive it without timers.
 */
export function createThrottle(
  intervalMs: number,
  send: (value: number) => void,
  now: () => number,
  schedule: (fn: () => void, ms: number) => () => void,
): { push: (value: number) => void; flush: () => void; cancel: () => void } {
  let last = -Infinity;
  let pending: number | null = null;
  let sent: number | null = null;
  let cancelTimer: (() => void) | null = null;
  const fire = (): void => {
    cancelTimer = null;
    if (pending === null) return;
    last = now();
    sent = pending;
    send(pending);
    pending = null;
  };
  return {
    push(value) {
      pending = value;
      const wait = last + intervalMs - now();
      if (wait <= 0) fire();
      else if (!cancelTimer) cancelTimer = schedule(fire, wait);
    },
    flush() {
      cancelTimer?.();
      cancelTimer = null;
      if (pending !== null && pending !== sent) fire();
      pending = null;
    },
    cancel() {
      cancelTimer?.();
      cancelTimer = null;
      pending = null;
    },
  };
}
