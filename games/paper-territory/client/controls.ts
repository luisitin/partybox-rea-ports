// Absolute screen directions are never rotated with the runner. The server judges each turn.
import type { Direction, Input } from '../server/types';

export const DIRECTIONS: readonly {
  dir: Direction;
  name: string;
  arrow: string;
  position: string;
}[] = [
  { dir: 0, name: 'Up', arrow: '↑', position: 'up' },
  { dir: 1, name: 'Right', arrow: '→', position: 'right' },
  { dir: 2, name: 'Down', arrow: '↓', position: 'down' },
  { dir: 3, name: 'Left', arrow: '←', position: 'left' },
];

interface ControlState {
  phaseId: string;
  paused: boolean;
  alive: boolean;
  me: { role: 'player' | 'spectator' };
  movingDir: Direction;
  dir: Direction;
}

export function canSteer(view: ControlState): boolean {
  return view.phaseId === 'play' && !view.paused && view.alive && view.me.role === 'player';
}

export function directionRequest(view: ControlState, dir: Direction): Input | null {
  // A second tap can cancel an in-flight turn before the next view arrives.
  // The server safely deduplicates headings against its current queue.
  if (!canSteer(view) || isReverse(view, dir)) return null;
  return { type: 'direction', dir };
}

export function isReverse(view: ControlState, dir: Direction): boolean {
  return dir === (view.movingDir + 2) % 4;
}

export function directionForKey(key: string): Direction | null {
  switch (key.toLowerCase()) {
    case 'arrowup':
    case 'w':
      return 0;
    case 'arrowright':
    case 'd':
      return 1;
    case 'arrowdown':
    case 's':
      return 2;
    case 'arrowleft':
    case 'a':
      return 3;
    default:
      return null;
  }
}

export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
