// Shared display helpers stay on the phone side without importing the TV or the server runtime.
import type { Translator } from '@partybox/game-sdk/ui';

// The pickup marks are shared with the TV legend so its symbols always name the same crate.
export const WEAPON_MARKS = {
  scatter: 'M-2 0H2M-1.5-1.5 1.5 1.5M-1.5 1.5 1.5-1.5',
  beam: 'M-2 1 0-1H2M0-1 0 1',
  guided: 'M-2 1Q-2-2 1-1M0-2 2-1 0 0',
} as const;

export const playerColor = (slot: number): string =>
  `var(--pb-player-${(((slot % 8) + 8) % 8) + 1})`;

export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function weaponName(weapon: string, L: Translator): string {
  if (weapon === 'scatter') return L('Burst');
  if (weapon === 'beam') return L('Beam');
  if (weapon === 'guided') return L('Seeker');
  return L('Shell');
}
