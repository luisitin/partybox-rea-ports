// The press under CardHand's drag (useHandDrag), apart from React and the DOM so a test can drive it.
// A pressed card lifts after a small move or a short hold. Once up it has left the finger, so the
// browser's click that follows lands on a neighbour or on the table: that click is swallowed wherever
// it lands, and the release decides. A press held still that never moved is a slow tap: it picks its
// own card (T-0342 review: it used to pick the neighbour, or call a playable card unplayable).

/** A pressed card lifts after this many px of movement, or this many ms held still. */
export const LIFT_MOVE = 7;
export const LIFT_HOLD = 240;

export interface PressAt {
  pointerId: number;
  x: number;
  y: number;
  /** The event's time stamp (a slow tap picks at it). */
  t: number;
}

/** The pressed card and the finger: where it went down, where it is. */
export interface Pressed {
  id: string;
  x0: number;
  y0: number;
  x: number;
  y: number;
}

export interface PressHooks {
  /** Lift the pressed card onto the finger; false if it cannot (it left the hand). */
  lift: (p: Readonly<Pressed>) => boolean;
  /** The finger moved while the card is up. */
  follow: (x: number, y: number) => void;
  /** The card comes down: dropped where it is, or with `home` sent back without a move. */
  land: (home: boolean) => void;
  /** A slow tap: pick the card, as a tap would. */
  tap: (id: string, t: number) => void;
}

export interface Clock {
  set: (run: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const TIMERS: Clock = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface Press {
  /** A press on card `id` (a new press also ends any old click guard). */
  down: (id: string, at: PressAt) => void;
  move: (at: PressAt) => void;
  /** The finger lifted (`cancel`: the browser took the pointer, or capture was lost). */
  end: (at: PressAt, cancel: boolean) => void;
  /** True once for the click that follows a lift: it must not pick. */
  swallow: () => boolean;
  /** A press elsewhere in the hand: the guard of an old lift no longer applies. */
  reset: () => void;
  busy: () => boolean;
}

export function createPress(hooks: PressHooks, clock: Clock = TIMERS): Press {
  let p: (Pressed & { pointerId: number; moved: boolean; up: boolean; timer: unknown }) | null =
    null;
  let guard = false;
  const raise = (): void => {
    if (!p || p.up) return;
    clock.clear(p.timer);
    p.up = hooks.lift(p);
  };
  return {
    down: (id, at) => {
      guard = false;
      if (p) return;
      p = { id, pointerId: at.pointerId, x0: at.x, y0: at.y, x: at.x, y: at.y, moved: false, up: false, timer: null }; // prettier-ignore
      p.timer = clock.set(raise, LIFT_HOLD);
    },
    move: (at) => {
      if (!p || at.pointerId !== p.pointerId) return;
      p.x = at.x;
      p.y = at.y;
      if (!p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > LIFT_MOVE) {
        p.moved = true;
        raise();
      }
      if (p.up) hooks.follow(p.x, p.y);
    },
    end: (at, cancel) => {
      const q = p;
      if (!q || at.pointerId !== q.pointerId) return;
      p = null;
      clock.clear(q.timer);
      // A quick tap never lifted: the browser's click picks the card under the finger.
      if (!q.up) return;
      guard = true;
      const slow = !q.moved && !cancel;
      hooks.land(cancel || slow);
      if (slow) hooks.tap(q.id, at.t);
    },
    swallow: () => {
      const was = guard;
      guard = false;
      return was;
    },
    reset: () => {
      guard = false;
    },
    busy: () => p !== null,
  };
}
