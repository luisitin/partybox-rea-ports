// Shared display and input geometry; the server remains the only simulation.
import type { CSSProperties } from 'react';

export function playerStyle(slot: number): CSSProperties {
  return { ['--snake-color' as string]: `var(--pb-player-${(Math.max(0, slot) % 8) + 1})` };
}

export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The pad is absolute heading: a drag right always means right, regardless of the snake's heading. */
export function pointerHeading(x: number, y: number, width: number, height: number): number | null {
  const dx = x - width / 2;
  const dy = y - height / 2;
  if (Math.hypot(dx, dy) < Math.min(width, height) / 12) return null;
  return Math.atan2(dy, dx);
}

export function keyboardHeading(keys: ReadonlySet<string>): number | null {
  const x = Number(keys.has('right')) - Number(keys.has('left'));
  const y = Number(keys.has('down')) - Number(keys.has('up'));
  return x === 0 && y === 0 ? null : Math.atan2(y, x);
}
