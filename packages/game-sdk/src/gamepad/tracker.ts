// T-0602 / ADR-090: the edge/repeat tracker the pad engine feeds with `navigator.getGamepads()` snapshots.
// Pure and tested; kept out of core.ts so the join page does not download it until a pad shows up.
import { BUTTON_INDEX, PAD_BUTTONS } from './core';
import type { PadButton } from './core';

/** One poll of a pad: the buttons' pressed flags and the stick axes (a plain copy, no DOM types). */
export interface PadSample {
  buttons: readonly boolean[];
  /** Left stick, −1..1 (x right, y down). */
  lx: number;
  ly: number;
  /** Right stick, same range; used as a second D-pad. */
  rx?: number;
  ry?: number;
}

export const STICK_DEADZONE = 0.55;
export const REPEAT_DELAY_MS = 400;
export const REPEAT_EVERY_MS = 120;

/** What a pad does at one moment: a button went down (or auto-repeats, for the directions). */
export interface PadPress {
  button: PadButton;
  /** True on a held direction's auto-repeat, false on the first press. */
  repeat: boolean;
}

const DIRS = ['up', 'down', 'left', 'right'] as const;

/** The directions a sample holds: the D-pad buttons plus either stick pushed past the deadzone. */
function heldDirs(s: PadSample): Set<PadButton> {
  const held = new Set<PadButton>();
  for (const d of DIRS) if (s.buttons[BUTTON_INDEX[d]]) held.add(d);
  const stick = (x: number, y: number): void => {
    if (Math.hypot(x, y) < STICK_DEADZONE) return;
    if (Math.abs(x) >= Math.abs(y)) held.add(x > 0 ? 'right' : 'left');
    else held.add(y > 0 ? 'down' : 'up');
  };
  stick(s.lx, s.ly);
  stick(s.rx ?? 0, s.ry ?? 0);
  return held;
}

/**
 * Edge detector. `step(sample, now)` returns the presses since the last call: a button that was
 * up and is now down; a held direction repeats after REPEAT_DELAY_MS, then every REPEAT_EVERY_MS
 * (the D-pad and the sticks share one repeat, so a menu scrolls). Triggers count as pressed past
 * half travel (a pad that reports them as buttons with `value` fills `buttons` already).
 */
export class PadTracker {
  private down = new Set<PadButton>();
  private nextRepeat = new Map<PadButton, number>();

  step(s: PadSample, now: number): PadPress[] {
    const out: PadPress[] = [];
    const dirs = heldDirs(s);
    const nowDown = new Set<PadButton>(dirs);
    for (const b of PAD_BUTTONS) {
      if ((DIRS as readonly string[]).includes(b)) continue;
      if (s.buttons[BUTTON_INDEX[b]]) nowDown.add(b);
    }
    for (const b of PAD_BUTTONS) {
      const isDown = nowDown.has(b);
      const wasDown = this.down.has(b);
      if (isDown && !wasDown) {
        out.push({ button: b, repeat: false });
        if (dirs.has(b)) this.nextRepeat.set(b, now + REPEAT_DELAY_MS);
      } else if (isDown && dirs.has(b)) {
        const due = this.nextRepeat.get(b) ?? Infinity;
        if (now >= due) {
          out.push({ button: b, repeat: true });
          this.nextRepeat.set(b, now + REPEAT_EVERY_MS);
        }
      } else if (!isDown) {
        this.nextRepeat.delete(b);
      }
    }
    this.down = nowDown;
    return out;
  }

  /** Forget everything held (the pad disconnected, or the page lost focus). */
  reset(): void {
    this.down.clear();
    this.nextRepeat.clear();
  }

  /** Is this button held right now (after the last `step`)? */
  isDown(b: PadButton): boolean {
    return this.down.has(b);
  }
}
