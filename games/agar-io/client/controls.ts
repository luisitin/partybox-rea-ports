import type { Input } from '../server/types';

export interface Vector {
  x: number;
  y: number;
}
export const STOP: Vector = { x: 0, y: 0 };
type Direction = 'up' | 'down' | 'left' | 'right';
export interface KeyInput {
  key: string;
  code?: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export function normalized(x: number, y: number): Vector {
  const length = Math.max(1, Math.hypot(x, y));
  return { x: Math.round((x / length) * 100) / 100, y: Math.round((y / length) * 100) / 100 };
}

/** The physical thumb and the transmitted direction share one 44px reach. */
export function padVector(dx: number, dy: number, reach = 44): Vector {
  const x = dx / Math.max(1, reach),
    y = dy / Math.max(1, reach);
  return Math.hypot(x, y) < 0.12 ? STOP : normalized(x, y);
}

export function editableKeyTarget(
  target: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  return Boolean(
    target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? ''),
  );
}

export function keyControl(event: KeyInput): Direction | 'split' | null {
  const key = event.key.toLowerCase();
  if (key === 'arrowup' || key === 'w') return 'up';
  if (key === 'arrowdown' || key === 's') return 'down';
  if (key === 'arrowleft' || key === 'a') return 'left';
  if (key === 'arrowright' || key === 'd') return 'right';
  if (event.code === 'Space' || key === ' ' || key === 'e') return 'split';
  return null;
}

/** No game state or prediction: only independent physical input sources. */
export class SteeringSession {
  private context = '';
  private active = false;
  private pointer: { id: number; vector: Vector } | null = null;
  private keys = new Map<string, Direction | 'split'>();
  private sent: Vector = STOP;
  constructor(
    private send: (input: Input) => void,
    private show: (vector: Vector) => void = () => undefined,
  ) {}
  setContext(context: string, active: boolean): number | null {
    if (context === this.context && active === this.active) return null;
    const id = this.reset();
    this.context = context;
    this.active = active;
    return id;
  }
  private publish(): void {
    const held = [...this.keys.values()];
    const vector =
      this.pointer?.vector ??
      normalized(
        Number(held.includes('right')) - Number(held.includes('left')),
        Number(held.includes('down')) - Number(held.includes('up')),
      );
    this.show(vector);
    if (vector.x === this.sent.x && vector.y === this.sent.y) return;
    this.sent = vector;
    this.send({ type: 'steer', ...vector });
  }
  key(event: KeyInput, down: boolean, editable: boolean, canSplit: boolean): boolean {
    const source = event.code || event.key.toLowerCase();
    if (!down) {
      if (!this.keys.delete(source)) return false;
      this.publish();
      return true;
    }
    if (!this.active || editable || event.altKey || event.ctrlKey || event.metaKey || event.repeat)
      return false;
    const control = keyControl(event);
    if (!control) return false;
    if (this.keys.has(source)) return true;
    this.keys.set(source, control);
    if (control === 'split') {
      if (canSplit) this.send({ type: 'split' });
    } else this.publish();
    return true;
  }
  pointerDown(id: number, vector: Vector): boolean {
    if (!this.active || this.pointer !== null) return false;
    this.pointer = { id, vector };
    this.publish();
    return true;
  }
  pointerMove(id: number, vector: Vector): void {
    if (!this.active || this.pointer?.id !== id) return;
    this.pointer = { id, vector };
    this.publish();
  }
  pointerUp(id: number): boolean {
    if (this.pointer?.id !== id) return false;
    this.pointer = null;
    this.publish();
    return true;
  }
  reset(): number | null {
    const id = this.pointer?.id ?? null;
    this.pointer = null;
    this.keys.clear();
    this.publish();
    return id;
  }
}
