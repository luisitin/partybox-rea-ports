import type { CSSProperties } from 'react';
import { ROUND_MS } from '../server/world';

/** Never draw more than one server beat ahead of judged play. */
export function visualTime(began: number, checked: number, now: number, frozen: boolean): number {
  const judged = Math.max(0, Math.min(ROUND_MS, checked));
  if (frozen) return judged;
  return Math.max(0, Math.min(ROUND_MS, judged + 100, now - began));
}

export function clockText(msLeft: number): string {
  const seconds = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Lane identity uses a number as well as the SDK's player colour. */
export function laneStyle(slot: number): CSSProperties {
  const lane = (((slot % 8) + 8) % 8) + 1;
  return { ['--pb-lane' as string]: `var(--pb-player-${lane})` };
}
