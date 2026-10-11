import type { CSSProperties } from 'react';
import type { MatchView } from '../server/index';
import { ROUND_MS, distanceAt } from '../server/world';

export const slotStyle = (slot: number): CSSProperties => ({
  ['--pb-runner' as string]: `var(--pb-player-${(Math.max(0, slot) % 8) + 1})`,
});

/** Drawing can lead the last judged frame by one network tick, never a whole lost connection. */
export function raceTime(view: MatchView, now: number, running: boolean): number {
  return running
    ? Math.min(ROUND_MS, view.checked + 100, Math.max(view.checked, now - view.began))
    : view.checked;
}

export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const runnerMetres = (runner: MatchView['runners'][number], t: number): number =>
  Math.floor((runner.died === null ? distanceAt(t) : runner.distance) / 10);

export interface StandingRow {
  id: string;
  name: string;
  slot: number;
  total: number;
  gained: number;
  rank: number;
  tied: boolean;
  out: boolean;
}

export function standingsRows(
  view: MatchView & { players: { id: string; name: string }[] },
): StandingRow[] {
  const rows = view.runners.map((runner, slot) => ({
    id: runner.id,
    name: view.players.find((p) => p.id === runner.id)?.name ?? runner.id,
    slot,
    total: view.scores[runner.id] ?? 0,
    gained: view.lastPoints[runner.id] ?? 0,
    out: runner.died !== null,
  }));
  return [...rows]
    .sort((a, b) => b.total - a.total || a.slot - b.slot)
    .map((row) => ({
      ...row,
      rank: 1 + rows.filter((other) => other.total > row.total).length,
      tied: rows.filter((other) => other.total === row.total).length > 1,
    }));
}
