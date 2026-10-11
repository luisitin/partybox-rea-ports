// Seeded groups of openings encourage cascades; the first three rings are safe to learn on.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { FLOOR_COUNT } from './types';
import type { Ring, Runner } from './types';

export const wrap = (degrees: number): number => ((degrees % 360) + 360) % 360;
export const angleDifference = (to: number, from: number): number => wrap(to - from + 180) - 180;

export function makeTower(rng: RngState): [Ring[], RngState] {
  const tower: Ring[] = [];
  let r = rng;
  let gap = 60;
  for (let i = 0; i < FLOOR_COUNT; i++) {
    let shift: number;
    [shift, r] = nextInt(r, i % 3 === 0 ? -85 : -18, i % 3 === 0 ? 85 : 18);
    if (i > 0) gap = wrap(gap + shift);
    const width = Math.max(76, 112 - Math.floor(i / 8) * 3);
    const dangerWidth = i < 3 ? 0 : Math.min(70, 30 + Math.floor(i / 10) * 5);
    tower.push({ gap, width, danger: wrap(gap + width / 2 + dangerWidth / 2 + 20), dangerWidth });
  }
  return [tower, r];
}

export function freshRunner(id: string, lives: number): Runner {
  return {
    id,
    angle: 0,
    dir: 0,
    heldUntil: 0,
    y: -0.8,
    vy: 0,
    floor: 0,
    chain: 0,
    best: 0,
    lives,
    respawnAt: null,
    crashed: 0,
    smashes: 0,
    cleared: false,
  };
}
