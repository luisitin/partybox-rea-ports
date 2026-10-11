import type { CSSProperties } from 'react';
import type { Runner } from '../server/types';

export const COLOURS = [
  { name: 'Pink', shape: 'Triangle', symbol: '▲', token: '--pb-player-1' },
  { name: 'Gold', shape: 'Circle', symbol: '●', token: '--pb-player-2' },
  { name: 'Green', shape: 'Diamond', symbol: '◆', token: '--pb-player-3' },
  { name: 'Blue', shape: 'Square', symbol: '■', token: '--pb-player-4' },
] as const;

export function colourOf(index: number): (typeof COLOURS)[number] {
  return COLOURS[((index % 4) + 4) % 4] ?? COLOURS[0];
}

export function colourStyle(index: number): CSSProperties {
  return { color: `var(${colourOf(index).token})` };
}

/** Increasing course phase slides the visible colour tiles towards the left. */
export function gateMovement(direction: number): 'left' | 'right' {
  return direction > 0 ? 'left' : 'right';
}

export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** This is a display of the server's best climb, never a client score decision. */
export function climbPoints(runner: Runner): number {
  const fraction = Math.floor(((runner.bestHeight - runner.gates * 120) * 100) / 120);
  return runner.gates * 100 + Math.max(0, Math.min(99, fraction));
}

export interface Row {
  id: string;
  name: string;
  gates: number;
  total: number;
  gained: number;
  connected: boolean;
}

export function roster(view: {
  players: { id: string; name: string; connected: boolean }[];
  world: { runners: Runner[] };
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
}): Row[] {
  return view.players.map((player) => ({
    ...player,
    gates: view.world.runners.find((runner) => runner.id === player.id)?.gates ?? 0,
    total: view.scores[player.id] ?? 0,
    gained: view.lastPoints[player.id] ?? 0,
  }));
}
