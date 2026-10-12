import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Cell, State, World } from '../server/types';

export const T0 = 1_000_000;
export const kit = testKit(game, { t0: T0, players: testPlayers(3), inputAt: 1000 });

export function cell(owner = 'p1', extra: Partial<Cell> = {}): Cell {
  return {
    id: 1,
    owner,
    x: 60,
    y: 50,
    mass: 24,
    vx: 0,
    vy: 0,
    mergeAt: 0,
    shieldUntil: 0,
    ...extra,
  };
}

export function world(cells: Cell[] = [cell()], extra: Partial<World> = {}): World {
  return {
    time: 0,
    serial: 100,
    cells,
    pellets: [],
    controls: Object.fromEntries(
      [...new Set(cells.map((c) => c.owner))].map((id) => [
        id,
        { x: 0, y: 0, at: 0, splitAt: -1000 },
      ]),
    ),
    respawns: {},
    ...extra,
  };
}

export function stateWithWorld(w: World): State {
  return { ...kit.start(), world: w };
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
