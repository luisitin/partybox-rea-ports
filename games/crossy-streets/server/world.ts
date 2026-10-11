import { nextFloat, nextInt, z } from '@partybox/game-sdk';
import type { PlayerInfo, RngState } from '@partybox/game-sdk';

export const WIDTH = 15;
export const ROWS = 256;
export const STEP_MS = 50;
export const TICK_MS = 200;
export const HOP_MS = 240;
export const ROUND_MS = 60_000;
export const IDLE_MS = 8000;
export const RESPAWN_MS = 1000;
/** A runner has a little breathing room after returning, without renewing the progress clock. */
export const RESPAWN_GRACE_MS = 2200;
export const RUNNER_RADIUS = 0.24;

export const inputSchema = z.object({
  type: z.literal('hop'),
  dir: z.enum(['up', 'down', 'left', 'right']),
});
export type Input = z.infer<typeof inputSchema>;
export type Direction = Input['dir'];
export type Death = 'car' | 'water' | 'edge' | 'eagle';

export interface LaneObject {
  /** Left edge, in cells. Objects are repeated on a period wider than the map. */
  x: number;
  length: number;
  variant: number;
}

export interface Lane {
  row: number;
  kind: 'grass' | 'road' | 'river';
  direction: -1 | 1;
  /** Cells per second, not pixels. */
  speed: number;
  period: number;
  offset: number;
  objects: LaneObject[];
  /** Tree centres; a blocked hop stays put rather than killing the runner. */
  blocked: number[];
}

export interface Runner {
  id: string;
  slot: number;
  x: number;
  row: number;
  alive: boolean;
  reviveAt: number | null;
  lastProgressAt: number;
  maxRow: number;
  deaths: number;
  lastHopAt: number;
  checkpointRow: number;
  checkpointX: number;
  lastDeath: Death | null;
  protectedUntil: number;
}

export interface World {
  lanes: Lane[];
  runners: Runner[];
  /** Last collision sample, in ms since the match began. */
  stepped: number;
}

const wrap = (value: number, period: number): number => ((value % period) + period) % period;

/** Public moving geometry. Clipped copies also cover the map's left edge. */
export function laneObjectsAt(lane: Lane, at: number, includeOffscreen = false): LaneObject[] {
  if (lane.kind === 'grass') return [];
  const out: LaneObject[] = [];
  for (const object of lane.objects) {
    const x = wrap(object.x + lane.offset + (lane.direction * lane.speed * at) / 1000, lane.period);
    for (const left of [x - lane.period, x]) {
      if (includeOffscreen || (left + object.length >= -0.5 && left <= WIDTH - 0.5))
        out.push({ ...object, x: left });
    }
  }
  return out;
}

/** Seed every lane before play. The map cannot depend on who reaches it first. */
export function createWorld(
  players: readonly PlayerInfo[],
  initialRng: RngState,
): [World, RngState] {
  let rng = initialRng;
  const draw = (): number => {
    const [value, next] = nextFloat(rng);
    rng = next;
    return value;
  };
  const integer = (min: number, max: number): number => {
    const [value, next] = nextInt(rng, min, max);
    rng = next;
    return value;
  };
  const lanes: Lane[] = [];
  let previous: Lane['kind'] = 'grass';
  let streak = 0;
  for (let row = 0; row < ROWS; row++) {
    // Start gently, then put a rest island at least every fourth row. Runs of one hazard
    // have a shared current direction; roads alternate so players cannot learn one timing.
    let kind: Lane['kind'] =
      row < 3 || row % 4 === 2 || row === ROWS - 1 ? 'grass' : draw() < 0.6 ? 'road' : 'river';
    if (kind === previous) streak++;
    else streak = 1;
    if (streak > 3) {
      kind = 'grass';
      streak = 1;
    }
    const direction: -1 | 1 = integer(0, 1) === 0 ? -1 : 1;
    const difficulty = Math.min(1, row / 45);
    const speed =
      kind === 'road'
        ? 1.8 + draw() * 1.4 + difficulty * 0.6
        : kind === 'river'
          ? 0.7 + draw() * 0.7
          : 0;
    const period = 22;
    const offset = draw() * period;
    const objects: LaneObject[] = [];
    const blocked: number[] = [];
    if (kind !== 'grass') {
      const count = kind === 'river' ? 4 : 3;
      for (let i = 0; i < count; i++) {
        objects.push({
          x: (i * period) / count,
          length: kind === 'river' ? 3.5 + draw() * 0.7 : 1.3 + draw() * 0.7,
          variant: integer(0, 3),
        });
      }
    } else if (row >= 3 && row !== ROWS - 1) {
      const count = integer(2, 4);
      for (let i = 0; i < count; i++) {
        const x = integer(0, WIDTH - 1);
        // A clear middle column makes every rest island passable and every checkpoint safe.
        if (x !== 7 && !blocked.includes(x)) blocked.push(x);
      }
      blocked.sort((a, b) => a - b);
    }
    lanes.push({ row, kind, direction, speed, period, offset, objects, blocked });
    previous = kind;
  }
  const runners: Runner[] = players.map((player, slot) => ({
    id: player.id,
    slot,
    x: 3 + slot,
    row: 0,
    alive: true,
    reviveAt: null,
    lastProgressAt: 0,
    maxRow: 0,
    deaths: 0,
    lastHopAt: -HOP_MS,
    checkpointRow: 0,
    checkpointX: 3 + slot,
    lastDeath: null,
    protectedUntil: 0,
  }));
  return [{ lanes, runners, stepped: 0 }, rng];
}

export function blockedAt(lane: Lane, x: number): boolean {
  return lane.blocked.some((tree) => Math.abs(tree - x) < 0.65);
}

/** The phone can predict this from public traffic and logs, and so can a bot. */
export function safeAt(lane: Lane, x: number, at: number): boolean {
  if (x < -0.25 || x > WIDTH - 0.75) return false;
  if (lane.kind === 'grass') return !blockedAt(lane, x);
  const objects = laneObjectsAt(lane, at);
  if (lane.kind === 'river')
    return objects.some(
      (log) => x - RUNNER_RADIUS >= log.x && x + RUNNER_RADIUS <= log.x + log.length,
    );
  return !objects.some(
    (car) => x + RUNNER_RADIUS > car.x && x - RUNNER_RADIUS < car.x + car.length,
  );
}

export function hopTarget(runner: Runner, direction: Direction): { x: number; row: number } {
  return {
    x: runner.x + (direction === 'left' ? -1 : direction === 'right' ? 1 : 0),
    row: runner.row + (direction === 'up' ? 1 : direction === 'down' ? -1 : 0),
  };
}

function deathAt(world: World, runner: Runner, at: number): Death | null {
  if (runner.x < -0.25 || runner.x > WIDTH - 0.75) return 'edge';
  const lane = world.lanes[runner.row];
  if (!lane) return 'edge';
  if (lane.kind !== 'grass' && !safeAt(lane, runner.x, at))
    return lane.kind === 'road' ? 'car' : 'water';
  if (at - runner.lastProgressAt >= IDLE_MS && at >= runner.protectedUntil) return 'eagle';
  return null;
}

function kill(runner: Runner, reason: Death, at: number): Runner {
  return {
    ...runner,
    alive: false,
    reviveAt: at + RESPAWN_MS,
    deaths: runner.deaths + 1,
    lastDeath: reason,
  };
}

/** Collision samples are fixed at 50 ms, independent of phone and timer arrival order. */
export function tick(world: World, to: number): World {
  const until = Math.min(ROUND_MS, Math.max(world.stepped, Math.floor(to / STEP_MS) * STEP_MS));
  if (until <= world.stepped) return world;
  let runners = world.runners;
  for (let at = world.stepped + STEP_MS; at <= until; at += STEP_MS) {
    runners = runners.map((original) => {
      let runner = original;
      if (!runner.alive) {
        if (runner.reviveAt === null || at < runner.reviveAt) return runner;
        return {
          ...runner,
          x: runner.checkpointX,
          row: runner.checkpointRow,
          alive: true,
          reviveAt: null,
          lastHopAt: at - HOP_MS,
          protectedUntil: at + RESPAWN_GRACE_MS,
        };
      }
      const lane = world.lanes[runner.row];
      if (lane?.kind === 'river')
        runner = { ...runner, x: runner.x + (lane.direction * lane.speed * STEP_MS) / 1000 };
      const death = deathAt(world, runner, at);
      return death === null ? runner : kill(runner, death, at);
    });
  }
  return { ...world, runners, stepped: until };
}

/** A hop is atomic, with immediate destination collisions and no reward for a lethal hop. */
export function apply(world: World, playerId: string, input: Input, at: number): World {
  // Input and collision geometry share one grid. Entering a river between network beats
  // therefore never gets an extra partial tick of log movement.
  at = Math.floor(at / STEP_MS) * STEP_MS;
  const index = world.runners.findIndex((runner) => runner.id === playerId);
  const original = world.runners[index];
  if (!original?.alive || at < world.stepped || at - original.lastHopAt < HOP_MS) return world;
  const target = hopTarget(original, input.dir);
  const lane = world.lanes[target.row];
  // The bottom and final row are map boundaries, not hazards. Side edges remain dangerous.
  if (!lane || (lane.kind === 'grass' && blockedAt(lane, target.x))) return world;
  let runner: Runner = { ...original, ...target, lastHopAt: at };
  const death = deathAt(world, runner, at);
  if (death !== null) runner = kill(runner, death, at);
  else if (target.row > original.maxRow) {
    runner = {
      ...runner,
      maxRow: target.row,
      lastProgressAt: at,
      ...(lane.kind === 'grass' ? { checkpointRow: target.row, checkpointX: target.x } : {}),
    };
  }
  const runners = [...world.runners];
  runners[index] = runner;
  return { ...world, runners };
}
