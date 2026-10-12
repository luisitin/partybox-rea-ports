// Shared display helpers stay on the phone side without importing the TV or the server runtime.
import type { Translator } from '@partybox/game-sdk/ui';

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
