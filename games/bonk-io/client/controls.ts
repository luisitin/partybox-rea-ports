import type { Input } from '../server/types';

export type Hold = 'left' | 'right' | 'heavy';
export type Control = Hold | 'jump';
export type Held = Record<Hold, readonly string[]>;

export const emptyHeld = (): Held => ({ left: [], right: [], heavy: [] });

/** Track each finger and key separately: releasing one cannot release another. */
export function holdSource(held: Held, control: Hold, source: string, down: boolean): Held {
  const sources = held[control];
  if (sources.includes(source) === down) return held;
  return {
    ...held,
    [control]: down ? [...sources, source] : sources.filter((item) => item !== source),
  };
}

export function command(held: Held, jump = false): Input {
  const left = held.left.length > 0;
  const right = held.right.length > 0;
  return {
    type: 'control',
    move: left === right ? 0 : left ? -1 : 1,
    heavy: held.heavy.length > 0,
    jump,
  };
}

export function keyControl(key: string): Control | null {
  switch (key.toLowerCase()) {
    case 'arrowleft':
    case 'a':
      return 'left';
    case 'arrowright':
    case 'd':
      return 'right';
    case 'arrowup':
    case 'w':
      return 'jump';
    case 'x':
    case 'shift':
      return 'heavy';
    default:
      return null;
  }
}

export function shortcutModified(modifiers: {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return modifiers.altKey || modifiers.ctrlKey || modifiers.metaKey;
}

/** Browser shortcuts must not start game input; their keyups still release old holds. */
export function keyEventControl(
  key: string,
  down: boolean,
  modifiers: { altKey: boolean; ctrlKey: boolean; metaKey: boolean },
): Control | null {
  if (down && shortcutModified(modifiers)) return null;
  return keyControl(key);
}

export function sameCommand(a: Input, b: Input): boolean {
  return a.move === b.move && a.heavy === b.heavy && a.jump === b.jump;
}

/** The actual controller's hold lifecycle, independent of React and browser timing. */
export class ControlSession {
  held = emptyHeld();
  jumpSources: readonly string[] = [];
  private key = '';
  private active = false;
  private last = command(this.held);

  constructor(private readonly send: (input: Input) => void) {}

  context(key: string, active: boolean): void {
    if (key !== this.key || !active) this.reset();
    this.key = key;
    this.active = active;
  }

  press(control: Hold, source: string, down: boolean): void {
    if (down && !this.active) return;
    this.held = holdSource(this.held, control, source, down);
    const next = command(this.held);
    if (sameCommand(this.last, next)) return;
    this.last = next;
    this.send(next);
  }

  jump(): void {
    if (this.active) this.send(command(this.held, true));
  }

  pressJump(source: string, down: boolean): boolean {
    if (down && !this.active) return false;
    if (this.jumpSources.includes(source) === down) return false;
    this.jumpSources = down
      ? [...this.jumpSources, source]
      : this.jumpSources.filter((item) => item !== source);
    if (down) this.jump();
    return down;
  }

  reset(): void {
    this.held = emptyHeld();
    this.jumpSources = [];
    const next = command(this.held);
    if (sameCommand(this.last, next)) return;
    this.last = next;
    this.send(next);
  }
}
