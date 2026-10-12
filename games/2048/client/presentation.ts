import type { CSSProperties } from 'react';
import type { RacerView } from '../server/types';

/** Formatting only: game rank, best tile and score always come from the server. */
export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ranked(racers: readonly RacerView[]): RacerView[] {
  return [...racers].sort((a, b) => a.rank - b.rank);
}

export function playerColor(slot: number): CSSProperties {
  return { ['--racer-color' as string]: `var(--pb-player-${(slot % 8) + 1})` };
}
