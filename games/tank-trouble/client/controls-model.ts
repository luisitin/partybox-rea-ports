// Independent buttons and steering contacts combine before one held command is published.
import type { Input } from '../server/world';

export type ControlAction = 'forward' | 'reverse' | 'left' | 'right' | 'fire';
export type ControlAxis = -1 | 0 | 1;
export type HeldControls = Record<ControlAction, boolean>;
export interface ControlUpdate {
  held: HeldControls;
  input: Input;
}

export const EMPTY_CONTROLS: HeldControls = {
  forward: false,
  reverse: false,
  left: false,
  right: false,
  fire: false,
};
export const NEUTRAL_CONTROL: Input = { type: 'control', drive: 0, turn: 0, fire: false };

export function createControlsModel() {
  const buttons = new Map<string, ControlAction>();
  const gestures = new Map<string, { drive: ControlAxis; turn: ControlAxis }>();

  const read = (): ControlUpdate => {
    const held = { ...EMPTY_CONTROLS };
    for (const action of buttons.values()) held[action] = true;
    for (const { drive, turn } of gestures.values()) {
      if (drive === 1) held.forward = true;
      if (drive === -1) held.reverse = true;
      if (turn === -1) held.left = true;
      if (turn === 1) held.right = true;
    }
    return {
      held,
      input: {
        type: 'control',
        drive: held.forward === held.reverse ? 0 : held.forward ? 1 : -1,
        turn: held.left === held.right ? 0 : held.right ? 1 : -1,
        fire: held.fire,
      },
    };
  };

  return {
    read,
    clear(): ControlUpdate {
      buttons.clear();
      gestures.clear();
      return read();
    },
    press(action: ControlAction, source: string, down: boolean): ControlUpdate | null {
      if (down) {
        if (buttons.get(source) === action) return null;
        buttons.set(source, action);
      } else if (!buttons.delete(source)) return null;
      return read();
    },
    steerStart(source: string, drive: ControlAxis, turn: ControlAxis): ControlUpdate | null {
      const old = gestures.get(source);
      if (old?.drive === drive && old.turn === turn) return null;
      gestures.set(source, { drive, turn });
      return read();
    },
    steerMove(source: string, drive: ControlAxis, turn: ControlAxis): ControlUpdate | null {
      const old = gestures.get(source);
      if (!old || (old.drive === drive && old.turn === turn)) return null;
      gestures.set(source, { drive, turn });
      return read();
    },
    steerEnd(source: string): ControlUpdate | null {
      if (!gestures.delete(source)) return null;
      return read();
    },
  };
}
