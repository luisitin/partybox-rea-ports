// Explicit fixture/stress provenance. Synthetic placements use the production views, never fake UI.
import { readFileSync } from 'node:fs';
import { game } from '../../games/hole-io/server/index';
import type { State } from '../../games/hole-io/server/types';
import { initial, T0 } from './simulate';

export const SURFACES = ['tv', 'phone-tv', 'phone-only', 'remote', 'spectator'] as const;
export interface Case {
  key: string;
  state: State;
  synthetic: string | null;
  surfaces: readonly (typeof SURFACES)[number][];
}
const longName = (i: number) => `${i + 1}ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklm`.slice(0, 40);
const named = (count: number): State => {
  const s = initial(count, 8);
  return {
    ...s,
    players: Object.fromEntries(
      Object.entries(s.players).map(([id, p], i) => [id, { ...p, name: longName(i) }]),
    ),
  };
};
export function cases(): Case[] {
  const list: Case[] = [];
  for (const phase of game.phases)
    list.push({
      key: phase,
      state: JSON.parse(readFileSync(`games/hole-io/fixtures/${phase}.json`, 'utf8')) as State,
      synthetic: null,
      surfaces: ['tv', 'phone-tv', 'phone-only', 'spectator'],
    });
  for (const count of [2, 4, 8])
    for (const long of [false, true])
      list.push({
        key: `${count}-${long ? 'long-names' : 'opening'}`,
        state: long ? named(count) : initial(count, 8),
        synthetic: long ? '40-character roster names' : null,
        surfaces: SURFACES,
      });
  const base = named(8);
  for (const [key, event] of [
    ['paused', { type: 'vip', now: T0 + 2000, action: 'pause' }],
    ['disconnected', { type: 'player', now: T0 + 2000, playerId: 'p1', connected: false }],
    ['reconnected', { type: 'player', now: T0 + 2000, playerId: 'p1', connected: true }],
    ['left', { type: 'player', now: T0 + 2000, playerId: 'p1', connected: false, gone: 'left' }],
  ] as const) {
    const from =
      key === 'reconnected'
        ? game.reduce(base, { type: 'player', now: T0 + 1000, playerId: 'p1', connected: false })
        : base;
    list.push({
      key,
      state: game.reduce(from, event),
      synthetic: 'named seeded fixture with reducer lifecycle event',
      surfaces: SURFACES,
    });
  }
  for (const [key, x, y] of [
    ['crowded', 90, 55],
    ['edge-northwest', 3, 4],
    ['edge-southeast', 177, 106],
  ] as const) {
    const s = {
      ...base,
      world: {
        ...base.world,
        holes: base.world.holes.map((h) => ({ ...h, x, y, immuneUntil: 0 })),
      },
    };
    list.push({
      key,
      state: s,
      synthetic: 'coincident/edge public identities for fit stress',
      surfaces: SURFACES,
    });
  }
  const prey = base.world.holes[0]!,
    predator = base.world.holes[1]!;
  const clash = {
    ...base,
    world: {
      ...base.world,
      holes: base.world.holes.map((h) =>
        h.id === 'p1'
          ? { ...h, x: 90, y: 55, score: 40, mass: 40, immuneUntil: 0 }
          : h.id === 'p2'
            ? { ...h, x: 90, y: 55, score: 120, mass: 120, immuneUntil: 0 }
            : h,
      ),
    },
  };
  const out = game.reduce(clash, { type: 'timer', now: T0 + 200, phaseId: 'play', startedAt: T0 });
  list.push({
    key: 'eliminated',
    state: out,
    synthetic: `predation setup ${prey.id} by ${predator.id}, production timer reduction`,
    surfaces: SURFACES,
  });
  list.push({
    key: 'all-out',
    state: {
      ...out,
      world: {
        ...out.world,
        holes: out.world.holes.map((h) => ({
          ...h,
          alive: false,
          eliminatedAt: 200,
          eliminatedBy: 'p2',
        })),
      },
    },
    synthetic: 'all seats inactive; shared clock continues',
    surfaces: SURFACES,
  });
  for (const [key, mass] of [
    ['cars-unlock', 27],
    ['houses-unlock', 82],
    ['towers-unlock', 165],
  ] as const) {
    const s = {
      ...base,
      world: {
        ...base.world,
        holes: base.world.holes.map((h) =>
          h.id === 'p1' ? { ...h, mass, score: mass, immuneUntil: 0 } : h,
        ),
      },
    };
    list.push({
      key,
      state: s,
      synthetic: `exact historical tuning threshold ${mass}`,
      surfaces: SURFACES,
    });
  }
  for (const age of [0, 300, 600]) {
    const h = base.world.holes[0]!;
    const p = {
      id: 9999,
      kind: 'house' as const,
      x: h.x,
      y: h.y,
      radius: 7,
      points: 4,
      by: h.id,
      consumedAt: 1000,
    };
    const s = {
      ...base,
      world: {
        ...base.world,
        elapsed: 1000 + age,
        holes: base.world.holes.map((a) =>
          a.id === h.id ? { ...a, mass: 82, score: 82, immuneUntil: 0 } : a,
        ),
        sinks: [p],
      },
    };
    list.push({
      key: `swallow-${age}`,
      state: s,
      synthetic: 'single known house sink receipt and fixed render age',
      surfaces: ['tv', 'phone-only'],
    });
  }
  for (const phase of ['reveal', 'done'] as const) {
    const tied = {
      ...base,
      world: {
        ...base.world,
        holes: base.world.holes.map((h) => ({
          ...h,
          score: 100,
          mass: 100,
          alive: h.slot % 2 === 0,
        })),
      },
    };
    const s = game.reduce(tied, {
      type: 'vip',
      now: T0,
      action: phase === 'reveal' ? 'skip' : 'end',
    });
    list.push({
      key: `long-tied-${phase}`,
      state: s,
      synthetic: 'eight equal banked scores; four eliminated; complete40-character names',
      surfaces: SURFACES,
    });
  }
  return list;
}
