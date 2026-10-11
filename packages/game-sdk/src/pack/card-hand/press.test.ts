// CardHand's press (press.ts): a quick tap is left to the browser's click; a press that lifted the
// card swallows the click after it, wherever it lands; a slow tap (held still past the lift) picks its
// own card and sends it home without a move (T-0342 review: it picked the neighbour).
import { describe, expect, it } from 'vitest';
import { createPress, LIFT_HOLD, LIFT_MOVE } from './press';
import type { Clock, PressHooks } from './press';

function rig(canLift = true): {
  press: ReturnType<typeof createPress>;
  calls: string[];
  wait: (ms: number) => void;
} {
  const calls: string[] = [];
  let due: { at: number; run: () => void } | null = null;
  let now = 0;
  const clock: Clock = {
    set: (run, ms) => (due = { at: now + ms, run }),
    clear: (h) => {
      if (h === due) due = null;
    },
  };
  const hooks: PressHooks = {
    lift: (p) => (calls.push(`lift ${p.id}`), canLift),
    follow: (x, y) => calls.push(`follow ${x},${y}`),
    land: (home) => calls.push(home ? 'home' : 'drop'),
    tap: (id, t) => calls.push(`tap ${id} @${t}`),
  };
  const wait = (ms: number): void => {
    now += ms;
    const d = due;
    if (d && d.at <= now) {
      due = null;
      d.run();
    }
  };
  return { press: createPress(hooks, clock), calls, wait };
}

const at = (x: number, y = 0, t = 0, pointerId = 1) => ({ pointerId, x, y, t });

describe('CardHand press', () => {
  it('a quick tap never lifts: the browser click picks, nothing is swallowed', () => {
    const { press, calls, wait } = rig();
    press.down('g3', at(0));
    wait(60);
    press.end(at(0, 0, 60), false);
    wait(LIFT_HOLD);
    expect(calls).toEqual([]);
    expect(press.swallow()).toBe(false);
  });

  it('a slow tap picks its own card, goes home without a move, and swallows the click', () => {
    const { press, calls, wait } = rig();
    press.down('g3', at(100, 400));
    wait(LIFT_HOLD + 360); // a 600 ms press, held still
    press.move(at(102, 401)); // finger jitter under the 7 px threshold
    press.end(at(102, 401, 600), false);
    expect(calls).toEqual(['lift g3', 'follow 102,401', 'home', 'tap g3 @600']);
    // The click after it hits the neighbour or the table: either one is swallowed, once.
    expect(press.swallow()).toBe(true);
    expect(press.swallow()).toBe(false);
  });

  it('a drag drops where it is and swallows the click; a cancel only goes home', () => {
    const { press, calls } = rig();
    press.down('g3', at(0));
    press.move(at(LIFT_MOVE + 1));
    press.move(at(40, -30));
    press.end(at(40, -30), false);
    expect(calls).toEqual(['lift g3', `follow ${LIFT_MOVE + 1},0`, 'follow 40,-30', 'drop']);
    expect(press.swallow()).toBe(true);
    const r = rig();
    r.press.down('b5', at(0));
    r.wait(LIFT_HOLD);
    r.press.end(at(0), true);
    expect(r.calls).toEqual(['lift b5', 'home']);
  });

  it('a new press clears a guard whose click never came (a long press with no click)', () => {
    const { press, wait } = rig();
    press.down('g3', at(0));
    wait(LIFT_HOLD);
    press.end(at(0), false);
    press.reset(); // the next press lands on the table between cards
    expect(press.swallow()).toBe(false);
    press.down('g4', at(0));
    expect(press.swallow()).toBe(false);
  });

  it('ignores other pointers and a second press, and a card that cannot lift stays a click', () => {
    const { press, calls, wait } = rig(false);
    press.down('g3', at(0));
    press.down('g4', at(0, 0, 0, 2));
    press.move(at(50, 0, 0, 2));
    press.end(at(50, 0, 0, 2), false);
    expect(press.busy()).toBe(true);
    wait(LIFT_HOLD);
    press.end(at(0), false);
    expect(calls).toEqual(['lift g3']);
    expect(press.swallow()).toBe(false);
    expect(press.busy()).toBe(false);
  });
});
