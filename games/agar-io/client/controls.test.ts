import { describe, expect, it } from 'vitest';
import type { Input } from '../server/types';
import { editableKeyTarget, normalized, padVector, SteeringSession } from './controls';

function setup() {
  const inputs: Input[] = [];
  const session = new SteeringSession((input) => inputs.push(input));
  session.setContext('play:1:p1:connected', true);
  return { inputs, session };
}

describe('physical steering', () => {
  it('uses the same half/full thumb reach independently of the surrounding pad size', () => {
    expect(padVector(22, 0)).toEqual({ x: 0.5, y: 0 });
    expect(padVector(44, 0)).toEqual({ x: 1, y: 0 });
    expect(padVector(0, -44)).toEqual({ x: 0, y: -1 });
    expect(padVector(4, 0)).toEqual({ x: 0, y: 0 });
    expect(padVector(88, 88)).toEqual(normalized(1, 1));
    expect(Math.hypot(...Object.values(padVector(88, 88)))).toBeLessThanOrEqual(1.01);
  });
  it('keeps aliases independent and opposing directions neutral', () => {
    const { session, inputs } = setup();
    session.key({ key: 'a', code: 'KeyA' }, true, false, false);
    session.key({ key: 'ArrowLeft', code: 'ArrowLeft' }, true, false, false);
    session.key({ key: 'a', code: 'KeyA' }, false, false, false);
    expect(inputs).toEqual([{ type: 'steer', x: -1, y: 0 }]);
    session.key({ key: 'd', code: 'KeyD' }, true, false, false);
    expect(inputs.at(-1)).toEqual({ type: 'steer', x: 0, y: 0 });
    session.key({ key: 'ArrowLeft', code: 'ArrowLeft' }, false, false, false);
    expect(inputs.at(-1)).toEqual({ type: 'steer', x: 1, y: 0 });
  });
  it('restores a held keyboard direction after only the pointer is released', () => {
    const { session, inputs } = setup();
    session.key({ key: 'd', code: 'KeyD' }, true, false, false);
    expect(session.pointerDown(1, { x: -0.5, y: 0 })).toBe(true);
    expect(session.pointerDown(2, { x: 0, y: 1 })).toBe(false);
    session.pointerMove(2, { x: 0, y: 1 });
    expect(session.pointerUp(2)).toBe(false);
    session.pointerUp(1);
    expect(inputs).toEqual([
      { type: 'steer', x: 1, y: 0 },
      { type: 'steer', x: -0.5, y: 0 },
      { type: 'steer', x: 1, y: 0 },
    ]);
    session.key({ key: 'd', code: 'KeyD' }, false, false, false);
    expect(inputs.at(-1)).toEqual({ type: 'steer', x: 0, y: 0 });
  });
});

describe('keyboard focus and shortcuts', () => {
  it.each([{ ctrlKey: true }, { altKey: true }, { metaKey: true }])(
    'ignores modified steering/split keydowns but still releases existing holds: %j',
    (modifier) => {
      const { session, inputs } = setup();
      for (const key of ['a', 'ArrowLeft', 'e', ' '])
        expect(session.key({ key, ...modifier }, true, false, true)).toBe(false);
      expect(inputs).toHaveLength(0);
      session.key({ key: 'a', code: 'KeyA' }, true, false, true);
      session.key({ key: 'a', code: 'KeyA', ...modifier }, false, false, true);
      expect(inputs.at(-1)).toEqual({ type: 'steer', x: 0, y: 0 });
    },
  );
  it.each([
    { tagName: 'INPUT' },
    { tagName: 'TEXTAREA' },
    { tagName: 'SELECT' },
    { isContentEditable: true },
  ])(
    'releases body-focused keys from an editable target without losing a separate pointer hold: %j',
    (target) => {
      const { session, inputs } = setup();
      const editable = editableKeyTarget(target);
      session.key({ key: 'a', code: 'KeyA' }, true, false, true);
      session.pointerDown(9, { x: 0.5, y: 0 });
      expect(session.key({ key: 'a', code: 'KeyA' }, false, editable, true)).toBe(true);
      for (const key of ['d', 'e', ' '])
        expect(session.key({ key }, true, editable, true)).toBe(false);
      expect(inputs.at(-1)).toEqual({ type: 'steer', x: 0.5, y: 0 });
      session.pointerUp(9);
      expect(inputs.at(-1)).toEqual({ type: 'steer', x: 0, y: 0 });
      expect(inputs.filter((input) => input.type === 'split')).toHaveLength(0);
    },
  );
  it('sends split once per fresh press, requires server readiness and ignores repeat', () => {
    const { session, inputs } = setup();
    session.key({ key: 'e', code: 'KeyE' }, true, false, false);
    session.key({ key: 'e', code: 'KeyE', repeat: true }, true, false, true);
    expect(inputs).toHaveLength(0);
    session.key({ key: 'e', code: 'KeyE' }, false, false, true);
    session.key({ key: 'e', code: 'KeyE' }, true, false, true);
    session.key({ key: 'e', code: 'KeyE' }, true, false, true);
    session.key({ key: 'e', code: 'KeyE', repeat: true }, true, false, true);
    expect(inputs).toEqual([{ type: 'split' }]);
  });
});

describe('input lifecycle', () => {
  it('routes held-source release through the latest sender without recreating the session', () => {
    const { session, inputs } = setup();
    const next: Input[] = [];
    session.pointerDown(17, { x: 1, y: 0 });
    session.setSender((input) => next.push(input));
    expect(session.setContext('play:1:p1:paused', false)).toBe(17);
    expect(inputs).toEqual([{ type: 'steer', x: 1, y: 0 }]);
    expect(next).toEqual([{ type: 'steer', x: 0, y: 0 }]);
    session.setContext('play:1:p1:connected', true);
    session.pointerMove(17, { x: 1, y: 0 });
    expect(next).toHaveLength(1);
  });
  it('starts a floating touch neutral and derives steering only from displacement after that press', () => {
    const { session, inputs } = setup();
    expect(session.pointerDown(5, padVector(0, 0))).toBe(true);
    expect(inputs).toHaveLength(0);
    session.pointerMove(5, padVector(22, 0));
    session.pointerMove(5, padVector(44, 0));
    session.pointerUp(5);
    expect(inputs).toEqual([
      { type: 'steer', x: 0.5, y: 0 },
      { type: 'steer', x: 1, y: 0 },
      { type: 'steer', x: 0, y: 0 },
    ]);
  });
  it('releases every source once on reset and requires a fresh physical press', () => {
    const { session, inputs } = setup();
    session.key({ key: 'w', code: 'KeyW' }, true, false, false);
    session.pointerDown(5, { x: 1, y: 0 });
    expect(session.reset()).toBe(5);
    session.reset();
    expect(
      inputs.filter((input) => input.type === 'steer' && input.x === 0 && input.y === 0),
    ).toHaveLength(1);
    session.pointerMove(5, { x: 1, y: 0 });
    session.key({ key: 'w', code: 'KeyW', repeat: true }, true, false, false);
    expect(inputs.at(-1)).toEqual({ type: 'steer', x: 0, y: 0 });
    session.key({ key: 'w', code: 'KeyW' }, false, false, false);
    session.key({ key: 'w', code: 'KeyW' }, true, false, false);
    expect(inputs.at(-1)).toEqual({ type: 'steer', x: 0, y: -1 });
  });
  it('a disconnect/reconnect in the same phase releases steer/split and never resumes them', () => {
    const { session, inputs } = setup();
    session.key({ key: 'd', code: 'KeyD' }, true, false, true);
    session.key({ key: 'e', code: 'KeyE' }, true, false, true);
    session.setContext('play:1:p1:disconnected', false);
    session.setContext('play:1:p1:connected', true);
    session.key({ key: 'd', code: 'KeyD', repeat: true }, true, false, true);
    session.key({ key: 'e', code: 'KeyE', repeat: true }, true, false, true);
    expect(inputs).toEqual([
      { type: 'steer', x: 1, y: 0 },
      { type: 'split' },
      { type: 'steer', x: 0, y: 0 },
    ]);
  });
  it('a new identity or round clears old holds while routine same-context views preserve them', () => {
    const { session, inputs } = setup();
    session.key({ key: 'd', code: 'KeyD' }, true, false, false);
    session.setContext('play:1:p1:connected', true);
    expect(inputs).toHaveLength(1);
    session.setContext('play:1:p2:connected', true);
    expect(inputs.at(-1)).toEqual({ type: 'steer', x: 0, y: 0 });
    session.pointerDown(1, { x: -1, y: 0 });
    session.setContext('play:2:p2:connected', true);
    expect(inputs.at(-1)).toEqual({ type: 'steer', x: 0, y: 0 });
  });
  it('returns the captured pointer for a changed context so the DOM can release capture immediately', () => {
    const { session, inputs } = setup();
    session.pointerDown(17, { x: 1, y: 0 });
    expect(session.setContext('play:1:p1:paused', false)).toBe(17);
    expect(session.setContext('play:1:p1:paused', false)).toBeNull();
    session.pointerMove(17, { x: -1, y: 0 });
    expect(inputs).toEqual([
      { type: 'steer', x: 1, y: 0 },
      { type: 'steer', x: 0, y: 0 },
    ]);
  });
  it('rejects actions while inactive', () => {
    const { session, inputs } = setup();
    session.setContext('score:1:p1', false);
    expect(session.pointerDown(1, { x: 1, y: 0 })).toBe(false);
    expect(session.key({ key: 'd' }, true, false, true)).toBe(false);
    expect(session.key({ key: 'e' }, true, false, true)).toBe(false);
    expect(inputs).toHaveLength(0);
  });
});
