import { describe, expect, it } from 'vitest';
import { BUTTON_INDEX, PAD, glyph, padKind } from './core';
import { PadTracker } from './tracker';
import type { PadSample } from './tracker';
import { pickNext } from './nav';

const sample = (down: number[] = [], lx = 0, ly = 0): PadSample => {
  const buttons = Array.from({ length: 17 }, (_, i) => down.includes(i));
  return { buttons, lx, ly };
};

describe('button mapping (Switch layout by position)', () => {
  it('maps A→Circle, B→Cross, X→Triangle, Y→Square', () => {
    expect(BUTTON_INDEX.a).toBe(PAD.circle);
    expect(BUTTON_INDEX.b).toBe(PAD.cross);
    expect(BUTTON_INDEX.x).toBe(PAD.triangle);
    expect(BUTTON_INDEX.y).toBe(PAD.square);
    expect([BUTTON_INDEX.l, BUTTON_INDEX.r]).toEqual([PAD.l1, PAD.r1]);
    expect([BUTTON_INDEX.zl, BUTTON_INDEX.zr]).toEqual([PAD.l2, PAD.r2]);
    expect([BUTTON_INDEX.plus, BUTTON_INDEX.minus]).toEqual([PAD.options, PAD.create]);
  });
});

describe('padKind / glyph', () => {
  it('detects a DualSense on Safari and Chrome id strings', () => {
    expect(
      padKind('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'),
    ).toBe('dualsense');
    expect(padKind('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe(
      'dualsense',
    );
    expect(padKind('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')).toBe(
      'xbox',
    );
    expect(padKind('some pad')).toBe('generic');
  });
  it('prints PlayStation shapes on a Sony pad and Switch letters otherwise', () => {
    expect(['a', 'b', 'x', 'y'].map((b) => glyph(b as 'a', 'dualsense'))).toEqual([
      '○',
      '✕',
      '△',
      '□',
    ]);
    expect(glyph('zl', 'dualsense')).toBe('L2');
    expect(glyph('a', 'generic')).toBe('A');
    expect(glyph('a', 'xbox')).toBe('B');
  });
});

describe('PadTracker', () => {
  it('reports a button once per press, not while held', () => {
    const t = new PadTracker();
    expect(t.step(sample(), 0)).toEqual([]);
    expect(t.step(sample([PAD.circle]), 16)).toEqual([{ button: 'a', repeat: false }]);
    expect(t.step(sample([PAD.circle]), 32)).toEqual([]);
    expect(t.step(sample(), 48)).toEqual([]);
    expect(t.step(sample([PAD.circle]), 64)).toHaveLength(1);
  });
  it('repeats a held direction after 400 ms, then every 120 ms', () => {
    const t = new PadTracker();
    expect(t.step(sample([PAD.down]), 0)).toEqual([{ button: 'down', repeat: false }]);
    expect(t.step(sample([PAD.down]), 399)).toEqual([]);
    expect(t.step(sample([PAD.down]), 400)).toEqual([{ button: 'down', repeat: true }]);
    expect(t.step(sample([PAD.down]), 519)).toEqual([]);
    expect(t.step(sample([PAD.down]), 520)).toEqual([{ button: 'down', repeat: true }]);
  });
  it('never repeats an action button', () => {
    const t = new PadTracker();
    t.step(sample([PAD.cross]), 0);
    expect(t.step(sample([PAD.cross]), 2000)).toEqual([]);
  });
  it('turns the left stick into a direction past the deadzone', () => {
    const t = new PadTracker();
    expect(t.step(sample([], 0.3, 0.2), 0)).toEqual([]);
    expect(t.step(sample([], 0.9, 0.2), 16)).toEqual([{ button: 'right', repeat: false }]);
    expect(t.step(sample([], 0.1, -0.9), 32)).toEqual([{ button: 'up', repeat: false }]);
  });
  it('forgets held buttons on reset', () => {
    const t = new PadTracker();
    t.step(sample([PAD.circle]), 0);
    t.reset();
    expect(t.step(sample([PAD.circle]), 16)).toEqual([{ button: 'a', repeat: false }]);
  });
});

describe('pickNext', () => {
  const box = (left: number, top: number) => ({ left, top, width: 100, height: 50 });
  it('prefers the control straight below over a nearer one off to the side', () => {
    const boxes = [box(0, 0), box(110, 20), box(0, 120)];
    expect(pickNext(boxes, 0, 'down')).toBe(2);
    expect(pickNext(boxes, 0, 'right')).toBe(1);
  });
  it('stays put at an edge, and lands on the first with no ring', () => {
    const boxes = [box(0, 0), box(0, 100)];
    expect(pickNext(boxes, 0, 'up')).toBe(-1);
    expect(pickNext(boxes, -1, 'down')).toBe(0);
    expect(pickNext([], 0, 'down')).toBe(-1);
  });
});
