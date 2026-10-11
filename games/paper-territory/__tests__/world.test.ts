import { describe, expect, it } from 'vitest';
import { testPlayers } from '@partybox/game-sdk/testing';
import {
  applyDirection,
  captureCells,
  createWorld,
  inputSchema,
  neighbour,
  neighbours,
  removeRunner,
  stepWorld,
  tickWorld,
} from '../server/world';
import { HEIGHT, RESPAWN_TICKS, TICK_MS, WIDTH } from '../server/types';
import type { Direction, Runner, World } from '../server/types';

const roster = testPlayers(2);
const cell = (x: number, y: number, width = 7): number => y * width + x;

function runner(slot: number, at: number, dir: Direction, extra: Partial<Runner> = {}): Runner {
  return {
    id: `p${slot + 1}`,
    slot,
    home: at,
    cell: at,
    dir,
    queued: dir,
    trail: [],
    alive: true,
    respawnTick: null,
    deaths: 0,
    area: 0,
    captures: 0,
    lastCapture: 0,
    cause: null,
    ...extra,
  };
}
function arena(runners: Runner[], owned: [number, number][] = [], width = 7, height = 7): World {
  const owners = Array<number>(width * height).fill(-1);
  for (const [at, slot] of owned) owners[at] = slot;
  return {
    width,
    height,
    owners,
    homes: Array<number>(width * height).fill(-1),
    runners,
    stepped: 0,
  };
}
function normalized(world: World): World {
  return { ...world, runners: [...world.runners].sort((a, b) => a.slot - b.slot) };
}

describe('grid, inputs and seed homes', () => {
  it('reproduces the old east-side idle swaps at tick eight', () => {
    const initial = createWorld(testPlayers(8));
    const legacy = {
      ...initial,
      runners: initial.runners.map((r) => {
        const dir: Direction = r.home % WIDTH < WIDTH / 2 ? 1 : 3;
        return { ...r, cell: r.home, dir, queued: dir };
      }),
    };
    expect(
      tickWorld(
        legacy,
        7,
        initial.runners.map((r) => r.id),
      ).runners.every((r) => r.alive),
    ).toBe(true);
    const swapped = tickWorld(
      legacy,
      8,
      initial.runners.map((r) => r.id),
    );
    expect(swapped.runners.filter((r) => !r.alive).map((r) => [r.slot, r.cause])).toEqual([
      [1, 'head'],
      [2, 'head'],
      [4, 'head'],
      [5, 'head'],
    ]);
  });

  it.each([2, 4, 8])(
    'gives every one of %i idle players two seconds to steer without an opening casualty',
    (count) => {
      const initial = createWorld(testPlayers(count));
      expect(initial.runners.map((r) => r.dir)).toEqual([1, 3, 2, 0, 1, 3, 0, 2].slice(0, count));
      for (const r of initial.runners) expect(initial.homes[r.cell]).toBe(r.slot);
      const open = tickWorld(
        initial,
        10,
        initial.runners.map((r) => r.id),
      );
      expect(open.runners.every((r) => r.alive && r.deaths === 0)).toBe(true);
    },
  );

  it('a later unattended north-wall crash is expected, rather than an opening head collision', () => {
    const initial = createWorld(testPlayers(8));
    const later = tickWorld(
      initial,
      14,
      initial.runners.map((r) => r.id),
    );
    expect(later.runners.filter((r) => r.deaths).map((r) => [r.slot, r.cause])).toEqual([
      [6, 'wall'],
    ]);
  });

  it('respawns each seat with its same safe opening heading', () => {
    const initial = createWorld(testPlayers(8));
    for (const r of initial.runners) {
      const dead = removeRunner(initial, r.slot, 'cut');
      const back = tickWorld(dead, RESPAWN_TICKS, [r.id]).runners[r.slot]!;
      expect(back.alive).toBe(true);
      expect(back.cell).toBe(r.home);
      expect([back.dir, back.queued]).toEqual([r.dir, r.dir]);
    }
  });

  it('uses a40×28 board and a200ms simulation step with a3second respawn', () => {
    expect([WIDTH, HEIGHT, TICK_MS, RESPAWN_TICKS]).toEqual([40, 28, 200, 15]);
    const world = createWorld(testPlayers(8));
    expect(world.owners).toHaveLength(1120);
    expect(world.homes).toHaveLength(1120);
    for (const r of world.runners) {
      expect(world.owners.filter((owner) => owner === r.slot)).toHaveLength(9);
      expect(world.homes.filter((owner) => owner === r.slot)).toHaveLength(9);
      expect(world.owners[r.cell]).toBe(r.slot);
      expect(r.area).toBe(9);
      expect(r.alive).toBe(true);
    }
  });

  it('has four cardinal neighbours with no row wrapping or diagonal movement', () => {
    expect(neighbours(cell(3, 3), 7, 7).sort((a, b) => a - b)).toEqual(
      [cell(3, 2), cell(2, 3), cell(4, 3), cell(3, 4)].sort((a, b) => a - b),
    );
    expect(neighbour(cell(0, 3), 3, 7, 7)).toBe(-1);
    expect(neighbour(cell(6, 3), 1, 7, 7)).toBe(-1);
    expect(neighbour(cell(3, 0), 0, 7, 7)).toBe(-1);
    expect(neighbour(cell(3, 6), 2, 7, 7)).toBe(-1);
    expect(neighbours(0, 7, 7)).toEqual([1, 7]);
  });

  it('only accepts integer cardinal direction inputs', () => {
    for (const dir of [0, 1, 2, 3])
      expect(inputSchema.safeParse({ type: 'direction', dir }).success).toBe(true);
    for (const dir of [-1, 4, 0.5, Number.NaN, Number.POSITIVE_INFINITY, '1'])
      expect(inputSchema.safeParse({ type: 'direction', dir }).success).toBe(false);
    expect(inputSchema.safeParse({ type: 'steer', dir: 1 }).success).toBe(false);
  });

  it('queues a perpendicular turn and ignores reversal, same direction, dead or unknown runners', () => {
    const world = arena([runner(0, cell(3, 3), 1)]);
    expect(applyDirection(world, 'p1', { type: 'direction', dir: 3 })).toBe(world);
    expect(applyDirection(world, 'p1', { type: 'direction', dir: 1 })).toBe(world);
    expect(applyDirection(world, 'spectator', { type: 'direction', dir: 0 })).toBe(world);
    const changed = applyDirection(world, 'p1', { type: 'direction', dir: 0 });
    expect(changed.runners[0]!.queued).toBe(0);
    expect(changed.runners[0]!.dir).toBe(1);
    expect(stepWorld(changed, ['p1']).runners[0]!.cell).toBe(cell(3, 2));
    expect(
      applyDirection(arena([runner(0, cell(3, 3), 1, { alive: false })]), 'p1', {
        type: 'direction',
        dir: 0,
      }).runners[0]!.queued,
    ).toBe(1);
  });
});

describe('four-neighbour territory capture', () => {
  const ring = [
    cell(2, 2),
    cell(3, 2),
    cell(4, 2),
    cell(4, 3),
    cell(4, 4),
    cell(3, 4),
    cell(2, 4),
    cell(2, 3),
  ];

  it('claims a closed trail and its enclosed interior, while leaving exterior cells alone', () => {
    const world = arena([runner(0, ring[0]!, 1)], [[ring[0]!, 0]]);
    const claimed = captureCells(world, 0, ring.slice(1));
    expect(claimed).toContain(cell(3, 3));
    for (const at of ring.slice(1)) expect(claimed).toContain(at);
    expect(claimed).not.toContain(cell(1, 3));
    expect(claimed).not.toContain(cell(5, 3));
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it('an open loop has a cardinal leak and does not claim its interior', () => {
    const world = arena([runner(0, ring[0]!, 1)], [[ring[0]!, 0]]);
    const claimed = captureCells(
      world,
      0,
      ring.slice(1).filter((at) => at !== cell(4, 3)),
    );
    expect(claimed).not.toContain(cell(3, 3));
  });

  it('diagonal gaps do not leak into an area sealed on all four cardinal sides', () => {
    const plus = [cell(3, 2), cell(2, 3), cell(4, 3), cell(3, 4)];
    const world = arena(
      [runner(0, cell(3, 2), 1)],
      plus.map((at) => [at, 0]),
    );
    const claimed = captureCells(world, 0, []);
    expect(claimed).toContain(cell(3, 3));
    expect(claimed).not.toContain(cell(2, 2));
    expect(claimed).not.toContain(cell(4, 4));
  });

  it('can steal rival territory inside a loop while respecting protected rival homes', () => {
    const world = arena(
      [runner(0, ring[0]!, 1), runner(1, cell(6, 6), 3)],
      [
        [ring[0]!, 0],
        [cell(3, 3), 1],
      ],
    );
    expect(captureCells(world, 0, ring.slice(1))).toContain(cell(3, 3));
    const protectedWorld = {
      ...world,
      homes: world.homes.map((owner, at) => (at === cell(3, 3) ? 1 : owner)),
    };
    expect(captureCells(protectedWorld, 0, ring.slice(1))).not.toContain(cell(3, 3));
  });

  it('closing a loop applies claims and clears the trail, with exact area accounting', () => {
    const world = arena(
      [runner(0, cell(2, 3), 0, { trail: ring.slice(1), area: 1 })],
      [[ring[0]!, 0]],
    );
    const closed = stepWorld(world, ['p1']);
    expect(closed.runners[0]!.alive).toBe(true);
    expect(closed.runners[0]!.trail).toEqual([]);
    expect(closed.runners[0]!.captures).toBe(1);
    expect(closed.runners[0]!.area).toBe(9);
    expect(closed.runners[0]!.lastCapture).toBe(8);
    expect(closed.owners[cell(3, 3)]).toBe(0);
  });
});

describe('simultaneous movement and deaths', () => {
  it('creates a vulnerable trail outside owned land and no trail while moving inside', () => {
    const world = arena(
      [runner(0, cell(2, 3), 1)],
      [
        [cell(2, 3), 0],
        [cell(3, 3), 0],
      ],
    );
    const first = stepWorld(world, ['p1']);
    expect(first.runners[0]!.trail).toEqual([]);
    const second = stepWorld(first, ['p1']);
    expect(second.runners[0]!.trail).toEqual([cell(4, 3)]);
  });

  it('dies at a wall and on its own trail, removing vulnerable trail immediately', () => {
    const wall = stepWorld(arena([runner(0, cell(6, 3), 1)]), ['p1']);
    expect(wall.runners[0]!.alive).toBe(false);
    expect(wall.runners[0]!.cause).toBe('wall');
    const self = stepWorld(arena([runner(0, cell(2, 3), 1, { trail: [cell(3, 3)] })]), ['p1']);
    expect(self.runners[0]!.alive).toBe(false);
    expect(self.runners[0]!.cause).toBe('trail');
    expect(self.runners[0]!.trail).toEqual([]);
    expect(self.runners[0]!.deaths).toBe(1);
  });

  it('kills both heads converging on one cell and both heads swapping cells', () => {
    for (const [a, b] of [
      [cell(2, 3), cell(4, 3)],
      [cell(2, 3), cell(3, 3)],
    ]) {
      const world = arena([runner(0, a!, 1), runner(1, b!, 3)]);
      const next = stepWorld(world, ['p1', 'p2']);
      expect(next.runners.map((r) => r.alive)).toEqual([false, false]);
      expect(next.runners.map((r) => r.cause)).toEqual(['head', 'head']);
      expect(
        normalized(stepWorld({ ...world, runners: [...world.runners].reverse() }, ['p2', 'p1'])),
      ).toEqual(normalized(next));
    }
  });

  it('a trail cut kills its owner before that owner can close the loop on the same tick', () => {
    const world = arena(
      [
        runner(0, cell(2, 3), 0, { trail: [cell(3, 2), cell(3, 3)], area: 1 }),
        runner(1, cell(4, 3), 3),
      ],
      [[cell(2, 2), 0]],
    );
    const next = stepWorld(world, ['p1', 'p2']);
    expect(next.runners[0]!.alive).toBe(false);
    expect(next.runners[0]!.cause).toBe('cut');
    expect(next.runners[0]!.captures).toBe(0);
    expect(next.runners[1]!.alive).toBe(true);
    expect(next.owners[cell(3, 2)]).toBe(-1);
    expect(
      normalized(stepWorld({ ...world, runners: [...world.runners].reverse() }, ['p2', 'p1'])),
    ).toEqual(normalized(next));
  });

  it('head collision wins over simultaneous trail cuts independent of runner iteration order', () => {
    const world = arena([
      runner(0, cell(2, 3), 1, { trail: [cell(2, 3)] }),
      runner(1, cell(3, 3), 3, { trail: [cell(3, 3)] }),
    ]);
    const next = stepWorld(world, ['p1', 'p2']);
    expect(next.runners.map((r) => [r.alive, r.cause, r.deaths])).toEqual([
      [false, 'head', 1],
      [false, 'head', 1],
    ]);
    expect(
      normalized(stepWorld({ ...world, runners: [...world.runners].reverse() }, ['p2', 'p1'])),
    ).toEqual(normalized(next));
  });

  it('same-tick overlapping captures stay neutral independent of runner iteration order', () => {
    const ring = (low: number, high: number): number[] => {
      const points: number[] = [];
      for (let x = low; x <= high; x++) points.push(cell(x, low), cell(x, high));
      for (let y = low + 1; y < high; y++) points.push(cell(low, y), cell(high, y));
      return points;
    };
    // Concentric, noncrossing loops close together. Both claim the neutral
    // centre, but neither new head touches the other loop's prior trail.
    const world = arena(
      [
        runner(0, cell(0, 1), 1, { trail: ring(1, 5).filter((at) => at !== cell(1, 1)) }),
        runner(1, cell(2, 1), 2, { trail: ring(2, 4).filter((at) => at !== cell(2, 2)) }),
      ],
      [
        [cell(1, 1), 0],
        [cell(2, 2), 1],
      ],
    );
    const next = stepWorld(world, ['p1', 'p2']);
    expect(next.runners.every((r) => r.alive)).toBe(true);
    expect(next.runners.every((r) => r.captures === 1)).toBe(true);
    expect(next.owners[cell(3, 3)]).toBe(-1);
    expect(
      normalized(stepWorld({ ...world, runners: [...world.runners].reverse() }, ['p2', 'p1'])),
    ).toEqual(normalized(next));
  });

  it('does not move an inactive runner and advances ticks deterministically in batches', () => {
    const world = arena([runner(0, cell(2, 3), 1), runner(1, cell(4, 5), 0)]);
    expect(stepWorld(world, ['p1']).runners[1]!.cell).toBe(world.runners[1]!.cell);
    expect(tickWorld(world, 3, ['p1', 'p2'])).toEqual(
      tickWorld(tickWorld(world, 1, ['p1', 'p2']), 3, ['p1', 'p2']),
    );
    const advanced = tickWorld(world, 3, ['p1', 'p2']);
    expect(tickWorld(advanced, 3, ['p1', 'p2'])).toBe(advanced);
    expect(tickWorld(advanced, 2, ['p1', 'p2'])).toBe(advanced);
  });
});

describe('respawn and protected homes', () => {
  it('loses exposed territory on death but keeps its nine home cells', () => {
    const world = createWorld(roster);
    world.owners[500] = 0;
    world.runners[0]!.trail = [501, 502];
    const dead = removeRunner(world, 0, 'cut');
    expect(dead.owners[500]).toBe(-1);
    expect(dead.runners[0]!.area).toBe(9);
    expect(dead.runners[0]!.trail).toEqual([]);
    expect(dead.runners[0]!.respawnTick).toBe(RESPAWN_TICKS);
    expect(dead.runners[0]!.deaths).toBe(1);
    expect(world.owners[500]).toBe(0);
  });

  it('waits exactly fifteen ticks to respawn, and never respawns a permanently removed seat', () => {
    const world = createWorld(roster);
    const dead = removeRunner(world, 0, 'cut');
    expect(tickWorld(dead, RESPAWN_TICKS - 1, ['p1']).runners[0]!.alive).toBe(false);
    const back = tickWorld(dead, RESPAWN_TICKS, ['p1']);
    expect(back.runners[0]!.alive).toBe(true);
    expect(back.runners[0]!.respawnTick).toBeNull();
    expect(tickWorld(dead, RESPAWN_TICKS + 1, []).runners[0]!.alive).toBe(false);
    const gone = removeRunner(world, 0, 'connection', true);
    expect(gone.runners[0]!.deaths).toBe(0);
    expect(gone.runners[0]!.respawnTick).toBeNull();
    expect(tickWorld(gone, 100, ['p1']).runners[0]!.alive).toBe(false);
  });

  it('waits when a moving enemy enters a due home and spawns after a moving enemy vacates it', () => {
    const home = cell(5, 5);
    const dead = runner(0, home, 1, { alive: false, respawnTick: 1, cause: 'cut', deaths: 1 });
    const occupied = stepWorld(arena([dead, runner(1, cell(6, 5), 3)], [[home, 0]]), ['p1', 'p2']);
    expect(occupied.runners[0]!.alive).toBe(false);
    expect(occupied.runners[0]!.deaths).toBe(1);
    expect(occupied.runners[1]!.alive).toBe(true);
    expect(occupied.runners[1]!.cell).toBe(home);
    const vacated = stepWorld(arena([dead, runner(1, home, 3)], [[home, 0]]), ['p1', 'p2']);
    expect(vacated.runners[0]!.alive).toBe(true);
    expect(vacated.runners[0]!.cell).toBe(home);
    expect(vacated.runners[0]!.trail).toEqual([]);
    expect(vacated.runners[1]!.alive).toBe(true);
    expect(vacated.runners[1]!.cell).toBe(cell(4, 5));
  });
});
