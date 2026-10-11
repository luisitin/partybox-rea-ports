// The dial's geometry and the huddle throttle (Tune In §5.9, §5.18 "Throttle").
import { describe, expect, it } from 'vitest';
import {
  BOX,
  createThrottle,
  faceLayout,
  pointAt,
  posFromPoint,
  posFromX,
  posToDeg,
  spokes,
  stackRings,
  wedges,
} from './geometry';

describe('positions', () => {
  it('maps 0 to the left end, 50 straight up, 100 to the right end', () => {
    expect(posToDeg(0)).toBe(180);
    expect(posToDeg(50)).toBe(90);
    expect(posToDeg(100)).toBe(0);
    expect(posToDeg(140)).toBe(0);
  });
  it('reads a pointer on a track as 0–100, clamped', () => {
    expect(posFromX(10, 10, 200)).toBe(0);
    expect(posFromX(110, 10, 200)).toBe(50);
    expect(posFromX(400, 10, 200)).toBe(100);
    expect(posFromX(5, 10, 0)).toBe(50);
  });
});

describe('the phone dial angle', () => {
  it('inverts posToDeg: every position read back from its own point on the arc', () => {
    for (let p = 0; p <= 100; p++) {
      const pt = pointAt(p, BOX.face * 0.82);
      expect(posFromPoint(pt.x, pt.y)).toBe(p);
    }
  });
  it('snaps a point below the pivot to the nearer end, and straight up to 50', () => {
    expect(posFromPoint(BOX.cx - 10, BOX.cy + 40)).toBe(0);
    expect(posFromPoint(BOX.cx + 10, BOX.cy + 40)).toBe(100);
    expect(posFromPoint(BOX.cx, BOX.cy - 200)).toBe(50);
  });
});

describe('wedges', () => {
  it('reads 2 · 3 · 4 · 3 · 2 around the target', () => {
    expect(wedges(50, [5, 10, 15]).map((w) => [w.from, w.to, w.pts])).toEqual([
      [35, 40, 2],
      [40, 45, 3],
      [45, 55, 4],
      [55, 60, 3],
      [60, 65, 2],
    ]);
  });
  it('clips at the ends of the dial and drops what is left of nothing', () => {
    const w = wedges(2, [5, 10, 15]);
    expect(w.map((x) => [x.from, x.to, x.pts])).toEqual([
      [0, 7, 4],
      [7, 12, 3],
      [12, 17, 2],
    ]);
  });
  it('leaves a sliver unlabelled so its number never spills', () => {
    const w = wedges(99, [5, 10, 15]);
    expect(w.find((x) => x.pts === 4)?.label).not.toBeNull();
    expect(wedges(100, [4, 8, 12]).every((x) => x.to <= 100)).toBe(true);
  });
});

describe("the reveal's faces", () => {
  const tv = faceLayout(900);
  const angle = (x: number, y: number): number =>
    (Math.atan2(BOX.cy - y, x - BOX.cx) * 180) / Math.PI;

  it('sit over their own value when they have room, the way the phone strip draws them', () => {
    const at = spokes([10, 50, 90], tv);
    [10, 50, 90].forEach((pos, i) => {
      const s = at[i];
      expect(s?.step).toBe(0);
      expect(angle(s?.x ?? 0, s?.y ?? 0)).toBeCloseTo(posToDeg(pos), 6);
    });
  });

  it("stack a crowd along each face's own spoke, never sideways (T-0162)", () => {
    for (const crowd of [
      [45, 45.5, 46, 46, 47],
      [27, 28, 29, 30, 31],
      [0, 1, 2, 2, 3, 4, 5],
      [95, 97, 98, 99, 100, 100],
    ]) {
      const at = spokes(crowd, tv);
      expect(at.some((s) => s.step !== 0)).toBe(true);
      crowd.forEach((pos, i) => {
        const s = at[i];
        if (!s) throw new Error('missing');
        // on its own spoke: the same angle as its value, whatever step it took
        expect(angle(s.x, s.y)).toBeCloseTo(posToDeg(pos), 6);
      });
      // and no two faces touch
      at.forEach((a, i) =>
        at.slice(i + 1).forEach((b) => {
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(tv.step - 1e-6);
        }),
      );
    }
  });

  it('slide a crowd too big for its spokes along the rim, never off its number (review F1)', () => {
    const closest = (at: readonly { x: number; y: number }[]): number =>
      Math.min(
        ...at.flatMap((a, i) => at.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))),
      );
    const four = (): readonly [number, number] => [45, 55];
    // A TV draws the dial 912 px wide in its layout at any size (a 720p TV scales the 1080p stage
    // to 2/3: 608 px on screen, the same room): ten dials within 48-52 and sixteen at one value.
    const drawn = faceLayout(912);
    const ten = spokes([48, 48.5, 49, 49, 49.5, 50, 50.5, 51, 51.5, 52], drawn, { range: four });
    const sixteen = spokes(Array<number>(16).fill(50), drawn, { range: four });
    for (const crowd of [ten, sixteen])
      expect(closest(crowd)).toBeGreaterThanOrEqual(drawn.step - 1e-6);
    for (const s of [...ten, ...sixteen]) {
      expect(s.at).toBeGreaterThanOrEqual(45);
      expect(s.at).toBeLessThanOrEqual(55);
      // a slid face rides the spoke of the value it is drawn at
      expect(angle(s.x, s.y)).toBeCloseTo(posToDeg(s.at), 6);
    }
  });

  it('never step out past the ends, where the end labels are: a crowd there stacks in', () => {
    const at = spokes([0, 1, 2, 2, 3, 4, 5], tv);
    for (const s of at) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.step).toBeLessThanOrEqual(0);
    }
    expect(at.some((s) => s.step < 0)).toBe(true);
  });

  it('spaces faces for the size the dial is drawn at', () => {
    const small = faceLayout(450);
    expect(small.step).toBeGreaterThan(tv.step);
    expect(small.rim).toBeGreaterThan(tv.rim);
    // A 40 px face and its air fit between neighbours, at either size.
    for (const [px, l] of [
      [900, tv],
      [450, small],
    ] as const)
      expect((l.step * px) / 1000).toBeGreaterThanOrEqual(46 - 1e-6);
  });
});

describe('stacking', () => {
  it('pushes a face that lands on another one ring out', () => {
    expect(stackRings([50, 51, 52, 80])).toEqual([0, 1, 2, 0]);
    expect(stackRings([10, 30])).toEqual([0, 0]);
  });

  it('takes the lowest free ring, even when the clash up there came first (T-0121)', () => {
    // 57 meets 60 on ring 0 and 54 on ring 1: it goes to ring 2 (it sat on 54 before)
    expect(stackRings([50, 54, 60, 57], 6)).toEqual([0, 1, 0, 2]);
  });
});

describe('the huddle throttle', () => {
  function rig(): {
    sent: number[];
    tick: (ms: number) => void;
    push: (v: number) => void;
    flush: () => void;
  } {
    let clock = 0;
    const timers: { at: number; fn: () => void }[] = [];
    const sent: number[] = [];
    const t = createThrottle(
      334,
      (v) => sent.push(v),
      () => clock,
      (fn, ms) => {
        const timer = { at: clock + ms, fn };
        timers.push(timer);
        return () => timers.splice(timers.indexOf(timer), 1);
      },
    );
    const tick = (ms: number): void => {
      clock += ms;
      for (const timer of [...timers].sort((a, b) => a.at - b.at))
        if (timer.at <= clock) {
          timers.splice(timers.indexOf(timer), 1);
          timer.fn();
        }
    };
    return { sent, tick, push: t.push, flush: t.flush };
  }

  it('a two-second drag at 60 moves a second sends at most 3 dials per second, plus release', () => {
    const r = rig();
    for (let i = 0; i < 120; i += 1) {
      r.push(i % 101);
      r.tick(1000 / 60);
    }
    const duringDrag = r.sent.length;
    expect(duringDrag).toBeLessThanOrEqual(7);
    r.push(64);
    r.flush();
    expect(r.sent.at(-1)).toBe(64);
    expect(r.sent.length).toBeLessThanOrEqual(duringDrag + 1);
  });

  it('release sends nothing new when the last value already went out', () => {
    const r = rig();
    r.push(10);
    expect(r.sent).toEqual([10]);
    r.flush();
    expect(r.sent).toEqual([10]);
  });
});
