// Contact aggregation is independent of React, layout and server timing.
import { describe, expect, it } from 'vitest';
import { createControlsModel, NEUTRAL_CONTROL } from '../client/controls-model';

describe('held steering contacts', () => {
  it('starts and changes both steering axes as one complete command', () => {
    const model = createControlsModel();
    const start = model.steerStart('pointer:1', 1, 1)!;
    expect(start.input).toEqual({ type: 'control', drive: 1, turn: 1, fire: false });
    expect(start.held).toEqual({
      forward: true,
      reverse: false,
      left: false,
      right: true,
      fire: false,
    });
    expect(model.steerMove('pointer:1', -1, -1)!.input).toEqual({
      type: 'control',
      drive: -1,
      turn: -1,
      fire: false,
    });
    expect(model.steerEnd('pointer:1')!.input).toEqual(NEUTRAL_CONTROL);
  });

  it('keeps fire and keyboard sources independent when steering is released', () => {
    const model = createControlsModel();
    model.press('fire', 'pointer:2', true);
    model.press('left', 'key:a', true);
    const steering = model.steerStart('pointer:1', 1, 1)!;
    expect(steering.input).toEqual({ type: 'control', drive: 1, turn: 0, fire: true });
    expect(steering.held.left).toBe(true);
    expect(steering.held.right).toBe(true);
    expect(model.steerEnd('pointer:1')!.input).toEqual({
      type: 'control',
      drive: 0,
      turn: -1,
      fire: true,
    });
    expect(model.press('left', 'key:a', false)!.input).toEqual({
      type: 'control',
      drive: 0,
      turn: 0,
      fire: true,
    });
    expect(model.press('fire', 'pointer:2', false)!.input).toEqual(NEUTRAL_CONTROL);
  });

  it('reveals the remaining gesture when opposing contacts cancel', () => {
    const model = createControlsModel();
    model.steerStart('pointer:1', 1, -1);
    const opposing = model.steerStart('pointer:2', -1, 1)!;
    expect(opposing.input).toEqual(NEUTRAL_CONTROL);
    expect(Object.values(opposing.held).filter(Boolean)).toHaveLength(4);
    expect(model.steerEnd('pointer:2')!.input).toEqual({
      type: 'control',
      drive: 1,
      turn: -1,
      fire: false,
    });
  });

  it('ignores repeated zones and releases while retaining neutral contact registration', () => {
    const model = createControlsModel();
    expect(model.steerStart('pointer:1', 0, 0)!.input).toEqual(NEUTRAL_CONTROL);
    expect(model.steerMove('pointer:1', 0, 0)).toBeNull();
    expect(model.steerMove('pointer:1', 1, -1)!.input.drive).toBe(1);
    expect(model.steerMove('pointer:1', 1, -1)).toBeNull();
    expect(model.steerMove('pointer:1', 0, 0)!.input).toEqual(NEUTRAL_CONTROL);
    expect(model.steerMove('pointer:1', -1, 1)!.input.drive).toBe(-1);
    model.steerEnd('pointer:1');
    expect(model.steerEnd('pointer:1')).toBeNull();
    expect(model.steerMove('pointer:1', 1, 1)).toBeNull();
  });

  it('invalidates in-flight contacts on clear and requires a fresh start', () => {
    const model = createControlsModel();
    model.press('fire', 'pointer:2', true);
    model.press('forward', 'key:w', true);
    model.steerStart('pointer:1', 1, -1);
    expect(model.clear().input).toEqual(NEUTRAL_CONTROL);
    expect(model.read().held).toEqual({
      forward: false,
      reverse: false,
      left: false,
      right: false,
      fire: false,
    });
    expect(model.steerMove('pointer:1', 1, 1)).toBeNull();
    expect(model.steerEnd('pointer:1')).toBeNull();
    expect(model.press('fire', 'pointer:2', false)).toBeNull();
    expect(model.steerStart('pointer:1', -1, 1)!.input).toEqual({
      type: 'control',
      drive: -1,
      turn: 1,
      fire: false,
    });
  });

  it('lifting a duplicate button source preserves another held source', () => {
    const model = createControlsModel();
    model.press('fire', 'pointer:1', true);
    model.press('fire', 'key:enter', true);
    expect(model.press('fire', 'key:enter', true)).toBeNull();
    expect(model.press('fire', 'pointer:1', false)!.input.fire).toBe(true);
    expect(model.press('fire', 'key:enter', false)!.input.fire).toBe(false);
  });
});
