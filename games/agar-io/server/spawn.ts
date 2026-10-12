// Safe seeded respawns keep every seat playing without waiting for a phone.
import { nextInt } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { distance, radius } from './geometry';
import { H, PELLET_COUNT, SHIELD_MS, START_MASS, W } from './types';
import type { Cell, World } from './types';
import { makePellet } from './content';

export function spawnCell(
  world: World,
  owner: string,
  rng: RngState,
  shield = SHIELD_MS,
): [Cell, RngState] {
  let best = { x: W / 2, y: H / 2 };
  let margin = -Infinity;
  let r = rng;
  for (let i = 0; i < 8; i++) {
    let x: number, y: number;
    [x, r] = nextInt(r, 80, (W - 8) * 10);
    [y, r] = nextInt(r, 80, (H - 8) * 10);
    const p = { x: x / 10, y: y / 10 };
    const gap = Math.min(W, ...world.cells.map((c) => distance(p, c) - radius(c.mass)));
    if (gap > margin) {
      best = p;
      margin = gap;
    }
  }
  return [
    {
      id: world.serial,
      owner,
      ...best,
      mass: START_MASS,
      vx: 0,
      vy: 0,
      mergeAt: 0,
      shieldUntil: world.time + shield,
    },
    r,
  ];
}

export function makeWorld(rng: RngState, ids: string[]): [World, RngState] {
  let world: World = { time: 0, serial: 1, cells: [], pellets: [], controls: {}, respawns: {} };
  let r = rng;
  for (const owner of ids) {
    const [cell, next] = spawnCell(world, owner, r, 1000);
    r = next;
    world = {
      ...world,
      serial: world.serial + 1,
      cells: [...world.cells, cell],
      controls: { ...world.controls, [owner]: { x: 0, y: 0, at: 0, splitAt: -1000 } },
    };
  }
  for (let id = 0; id < PELLET_COUNT; id++) {
    const [pellet, next] = makePellet(r, id);
    world.pellets.push(pellet);
    r = next;
  }
  return [world, r];
}
