import { describe, expect, it } from 'vitest';
import type { Input } from '../server/types';
import {
  ControlSession,
  command,
  emptyHeld,
  holdSource,
  keyControl,
  keyEventControl,
  sameCommand,
} from './controls';

describe('hold controls', () => {
  it('keeps a second finger and a keyboard hold when the first finger is cancelled', () => {
    let held = holdSource(emptyHeld(), 'left', 'pointer:1', true);
    held = holdSource(held, 'left', 'pointer:2', true);
    held = holdSource(held, 'left', 'key:a', true);
    held = holdSource(held, 'left', 'pointer:1', false);
    expect(command(held).move).toBe(-1);
    held = holdSource(held, 'left', 'pointer:2', false);
    expect(command(held).move).toBe(-1);
    held = holdSource(held, 'left', 'key:a', false);
    expect(command(held)).toEqual({ type: 'control', move: 0, heavy: false, jump: false });
  });

  it('cancels opposite holds and resumes the remaining side on release', () => {
    let held = holdSource(emptyHeld(), 'left', 'key:a', true);
    held = holdSource(held, 'right', 'pointer:4', true);
    held = holdSource(held, 'heavy', 'pointer:5', true);
    expect(command(held)).toMatchObject({ move: 0, heavy: true });
    expect(command(holdSource(held, 'right', 'pointer:4', false))).toMatchObject({
      move: -1,
      heavy: true,
    });
  });

  it('does not duplicate repeated key presses or mutate old input', () => {
    const old = emptyHeld();
    const next = holdSource(old, 'heavy', 'key:shift', true);
    expect(holdSource(next, 'heavy', 'key:shift', true)).toBe(next);
    expect(old.heavy).toEqual([]);
    expect(command(next, true)).toMatchObject({ heavy: true, jump: true });
    expect(command(next).jump).toBe(false);
    expect(command(emptyHeld())).toMatchObject({ move: 0, heavy: false });
  });

  it('supports the advertised keys and never treats arbitrary keys as input', () => {
    for (const key of ['ArrowLeft', 'a', 'A']) expect(keyControl(key)).toBe('left');
    for (const key of ['ArrowRight', 'd', 'D']) expect(keyControl(key)).toBe('right');
    for (const key of ['ArrowUp', 'w', 'W']) expect(keyControl(key)).toBe('jump');
    for (const key of ['x', 'X', 'Shift']) expect(keyControl(key)).toBe('heavy');
    for (const key of ['Enter', ' ', 'Escape', 'Tab']) expect(keyControl(key)).toBeNull();
  });

  it.each([
    ['a', { altKey: false, ctrlKey: true, metaKey: false }],
    ['ArrowLeft', { altKey: true, ctrlKey: false, metaKey: false }],
    ['x', { altKey: false, ctrlKey: false, metaKey: true }],
    ['w', { altKey: true, ctrlKey: true, metaKey: true }],
  ] as const)(
    'ignores shortcut keydown %s but releases a previously held key on keyup',
    (key, modifiers) => {
      expect(keyEventControl(key, true, modifiers)).toBeNull();
      expect(keyEventControl(key, false, modifiers)).toBe(keyControl(key));
      const sent: Input[] = [];
      const session = new ControlSession((input) => sent.push(input));
      session.context('play:1', true);
      const control = keyControl(key);
      if (control !== null && control !== 'jump') {
        session.press(control, `key:${key}`, true);
        const release = keyEventControl(key, false, modifiers);
        if (release !== null && release !== 'jump') session.press(release, `key:${key}`, false);
        expect(sent.at(-1)).toMatchObject({ move: 0, heavy: false });
      }
    },
  );

  it('still accepts Shift alone and X as heavy, and Shift does not block steering', () => {
    const plain = { altKey: false, ctrlKey: false, metaKey: false };
    expect(keyEventControl('Shift', true, plain)).toBe('heavy');
    expect(keyEventControl('X', true, plain)).toBe('heavy');
    expect(keyEventControl('ArrowLeft', true, plain)).toBe('left');
  });

  it('distinguishes jump pulses from unchanged holds', () => {
    const input = command(emptyHeld());
    expect(sameCommand(input, command(emptyHeld()))).toBe(true);
    expect(sameCommand(input, command(emptyHeld(), true))).toBe(false);
  });

  it.each(['blur', 'pagehide', 'unmount', 'visibilitychange'])(
    '%s releases every hold once',
    () => {
      const sent: Input[] = [];
      const session = new ControlSession((input) => sent.push(input));
      session.context('play:1', true);
      session.press('left', 'pointer:1', true);
      session.press('heavy', 'key:x', true);
      session.reset();
      session.reset();
      expect(sent).toHaveLength(3);
      expect(sent.at(-1)).toEqual({ type: 'control', move: 0, heavy: false, jump: false });
      expect(session.held).toEqual(emptyHeld());
    },
  );

  it.each(['paused', 'out', 'left', 'score:1', 'play:2'])(
    '%s cancels the old round and cannot revive an old finger',
    (key) => {
      const sent: Input[] = [];
      const session = new ControlSession((input) => sent.push(input));
      session.context('play:1', true);
      session.press('right', 'pointer:2', true);
      session.context(key, key === 'play:2');
      session.press('right', 'pointer:2', false);
      expect(sent.at(-1)).toMatchObject({ move: 0, heavy: false });
      expect(session.held.right).toEqual([]);
      if (key !== 'play:2') {
        const count = sent.length;
        session.press('heavy', 'pointer:3', true);
        session.jump();
        expect(sent).toHaveLength(count);
      }
    },
  );

  it('a fresh jump preserves the currently held direction and weight', () => {
    const sent: Input[] = [];
    const session = new ControlSession((input) => sent.push(input));
    session.context('play:1', true);
    session.press('right', 'key:d', true);
    session.press('heavy', 'key:x', true);
    session.jump();
    expect(sent.at(-1)).toMatchObject({ move: 1, heavy: true, jump: true });
    session.press('heavy', 'key:x', false);
    expect(sent.at(-1)).toMatchObject({ move: 1, heavy: false, jump: false });
  });
});
