// Analytic sliding and overlap: the renderer and judge use the same geometry.
import { z } from '@partybox/game-sdk';
import type { Block, Tower } from './types';
import { RESTART_MS } from './types';

export const WIDTH = 80;
export const SWING = 96;
export const PERFECT = 2.6;
export const GROW = 8;
export const GROW_STREAK = 3;
export const MIN_WIDTH = 4;
export const DROP_MS = 300;
export const MAX_HEIGHT = 150;
export const KEEP_BLOCKS = 12;

export const inputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('drop'),
    attempt: z.number().int().min(0).max(200),
    level: z.number().int().min(0).max(MAX_HEIGHT),
  }),
  z.object({ type: z.literal('restart'), attempt: z.number().int().min(0).max(200) }),
]);
export type Input = z.infer<typeof inputSchema>;

const rounded = (value: number): number => Math.round(value * 1000) / 1000 || 0;

export function makeTower(id: string, now: number, previous?: Tower): Tower {
  const footprint: Block = { x: 0, z: 0, w: WIDTH, d: WIDTH };
  return {
    id,
    attempt: previous ? previous.attempt + 1 : 0,
    height: 0,
    best: previous?.best ?? 0,
    perfects: previous?.perfects ?? 0,
    streak: 0,
    footprint,
    blocks: [footprint],
    bestBlocks: previous?.bestBlocks ?? [footprint],
    movingSince: now,
    lastAt: now,
    crashedAt: null,
    feedback: 'align',
    cut: null,
  };
}

export const axisOf = (height: number): 'x' | 'z' => (height % 2 === 0 ? 'x' : 'z');

export function speedAt(height: number): number {
  return Math.min(170, 90 + height * 2);
}

/** Same height always has the same direction and speed for every seat and retry. */
export function offsetAt(tower: Tower, now: number, course: number): number {
  const elapsed = Math.max(0, now - tower.movingSince) / 1000;
  const distance = (elapsed * speedAt(tower.height)) % (SWING * 4);
  const offset = distance <= SWING * 2 ? -SWING + distance : SWING * 3 - distance;
  return rounded(offset * ((tower.height + course) % 2 === 0 ? 1 : -1));
}

export function movingBlock(tower: Tower, now: number, course: number): Block {
  const axis = axisOf(tower.height);
  return { ...tower.footprint, [axis]: tower.footprint[axis] + offsetAt(tower, now, course) };
}

export function tolerance(tower: Tower): number {
  return Math.min(
    PERFECT,
    (axisOf(tower.height) === 'x' ? tower.footprint.w : tower.footprint.d) * 0.06,
  );
}

export function drop(tower: Tower, now: number, course: number): Tower {
  if (tower.crashedAt !== null || now < tower.movingSince + DROP_MS || tower.height >= MAX_HEIGHT)
    return tower;
  const axis = axisOf(tower.height);
  const dim = axis === 'x' ? 'w' : 'd';
  const offset = offsetAt(tower, now, course);
  const lost = Math.abs(offset);
  const perfect = lost <= tolerance(tower);
  const size = perfect ? tower.footprint[dim] : rounded(tower.footprint[dim] - lost);
  if (size < MIN_WIDTH)
    return { ...tower, crashedAt: now, lastAt: now, streak: 0, feedback: 'miss', cut: null };
  const streak = tower.streak + 1;
  const growth = perfect && streak >= GROW_STREAK ? GROW : 0;
  const footprint: Block = {
    ...tower.footprint,
    [dim]: Math.min(WIDTH, rounded(size + growth)),
    [axis]: perfect ? tower.footprint[axis] : rounded(tower.footprint[axis] + offset / 2),
  };
  const height = tower.height + 1;
  const blocks = [...tower.blocks, footprint].slice(-KEEP_BLOCKS);
  const grew = footprint[dim] > tower.footprint[dim];
  return {
    ...tower,
    height,
    best: Math.max(tower.best, height),
    perfects: tower.perfects + (perfect ? 1 : 0),
    streak,
    footprint,
    blocks,
    bestBlocks: height > tower.best ? blocks : tower.bestBlocks,
    movingSince: now,
    lastAt: now,
    feedback: perfect ? (grew ? 'grow' : 'perfect') : 'trim',
    cut: perfect ? null : { axis, amount: rounded(lost), side: Math.sign(offset) },
  };
}

export function restart(tower: Tower, now: number): Tower {
  return tower.crashedAt === null || now < tower.crashedAt + RESTART_MS || tower.attempt >= 200
    ? tower
    : makeTower(tower.id, now, tower);
}
