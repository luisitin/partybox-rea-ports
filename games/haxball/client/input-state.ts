// Held controls are a set of independent input sources, not a single last button.
import type { Input } from '../server/types';

export type Direction =
  'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';
export type ControlAction = Direction | 'kick';
export type HeldSources = Readonly<Record<string, ControlAction>>;
export interface HeldVector {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  kick: boolean;
}

const vectors: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  'up-left': [-1, -1],
  'up-right': [1, -1],
  'down-left': [-1, 1],
  'down-right': [1, 1],
};

export function changeSource(
  held: HeldSources,
  source: string,
  action: ControlAction | null,
): HeldSources {
  if (held[source] === action || (action === null && !(source in held))) return held;
  const next = { ...held };
  if (action === null) delete next[source];
  else next[source] = action;
  return next;
}

export function heldVector(held: HeldSources): HeldVector {
  const actions = new Set(Object.values(held));
  let x = 0;
  let y = 0;
  for (const action of actions) {
    if (action === 'kick') continue;
    const vector = vectors[action];
    x += vector[0];
    y += vector[1];
  }
  return {
    dx: Math.sign(x) as -1 | 0 | 1,
    dy: Math.sign(y) as -1 | 0 | 1,
    kick: actions.has('kick'),
  };
}

export function sameVector(a: HeldVector, b: HeldVector): boolean {
  return a.dx === b.dx && a.dy === b.dy && a.kick === b.kick;
}

/** A reconnect must start above the server's accepted sequence, even on a fresh mount. */
export function controlPacket(
  previousSeq: number,
  acceptedSeq: number,
  phaseAt: number,
  held: HeldSources,
): Input {
  return {
    type: 'control',
    phaseAt,
    seq: Math.max(previousSeq + 1, acceptedSeq + 1, 0),
    ...heldVector(held),
  };
}

/** Eight directional cells, with a neutral centre; dragging out safely releases movement. */
export function directionAt(x: number, y: number, width: number, height: number): Direction | null {
  if (width <= 0 || height <= 0 || x < 0 || y < 0 || x >= width || y >= height) return null;
  const col = Math.min(2, Math.floor((x / width) * 3));
  const row = Math.min(2, Math.floor((y / height) * 3));
  const cells: readonly (Direction | null)[] = [
    'up-left',
    'up',
    'up-right',
    'left',
    null,
    'right',
    'down-left',
    'down',
    'down-right',
  ];
  return cells[row * 3 + col] ?? null;
}

export function keyAction(key: string): ControlAction | null {
  switch (key.toLowerCase()) {
    case 'arrowup':
    case 'w':
      return 'up';
    case 'arrowdown':
    case 's':
      return 'down';
    case 'arrowleft':
    case 'a':
      return 'left';
    case 'arrowright':
    case 'd':
      return 'right';
    case ' ':
    case 'x':
      return 'kick';
    default:
      return null;
  }
}
