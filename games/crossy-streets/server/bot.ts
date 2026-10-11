import type { BotSkill, Rng } from '@partybox/game-sdk';
import { blockedAt, hopTarget, HOP_MS, IDLE_MS, safeAt, STEP_MS, WIDTH } from './world';
import type { Direction, Input, Runner, World } from './world';

const DIRECTIONS: readonly Direction[] = ['up', 'left', 'right', 'down'];

/** Honest, local planning: only the public lane beside a runner and the next lane matter. */
export function botInput(
  world: World,
  playerId: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  const runner = world.runners.find((candidate) => candidate.id === playerId);
  const at = world.stepped;
  if (!runner?.alive) return null;
  // The short eagle grace is a recovery opportunity, not a fresh eight-second allowance.
  // Slow bots must be able to replay the old rows before that grace runs out. A new best
  // renews the progress clock and immediately restores their ordinary skill cadence.
  const recovering = at < runner.protectedUntil && at - runner.lastProgressAt >= IDLE_MS;
  const cadence = recovering ? HOP_MS : skill === 'sharp' ? 300 : skill === 'easy' ? 1000 : 600;
  if (runner.lastHopAt >= 0 && at - runner.lastHopAt < Math.max(HOP_MS, cadence)) return null;
  const horizon = recovering
    ? HOP_MS + STEP_MS
    : skill === 'sharp'
      ? 350
      : skill === 'easy'
        ? 950
        : 650;
  const score = (direction: Direction): number => {
    const target = hopTarget(runner, direction);
    const lane = world.lanes[target.row];
    if (!lane || blockedAt(lane, target.x) || !safeAt(lane, target.x, at)) return -Infinity;
    let x = target.x;
    for (let dt = STEP_MS; dt <= horizon; dt += STEP_MS) {
      if (lane.kind === 'river') x += (lane.direction * lane.speed * STEP_MS) / 1000;
      if (!safeAt(lane, x, at + dt)) return -1000 + dt;
    }
    const ahead = world.lanes[target.row + 1];
    const onward = ahead && safeAt(ahead, x, at + cadence) ? 70 : 0;
    // Getting off a road matters; a new best row matters most. Avoid drifting off the river.
    const progress = (target.row - runner.row) * 120 + (target.row > runner.maxRow ? 140 : 0);
    const bank = lane.kind === 'grass' ? 20 : 0;
    const centre = 7 - Math.abs(x - (WIDTH - 1) / 2);
    return progress + bank + onward + centre;
  };
  const candidates = DIRECTIONS.map((dir) => ({ dir, score: score(dir) }))
    .filter((candidate) => candidate.score !== -Infinity)
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) return null;
  if (best.score < 0 && safeToWait(world, runner, at, horizon)) return null;
  // Easy opponents make a few safe sideways detours; sharp ones keep the stronger plan.
  const detourChance = recovering ? 0 : skill === 'easy' ? 0.22 : skill === 'sharp' ? 0.015 : 0.07;
  const safe = candidates.filter((candidate) => candidate.score >= 0);
  const chosen = safe.length > 1 && rng.chance(detourChance) ? rng.pick(safe) : best;
  return { type: 'hop', dir: chosen.dir };
}

function safeToWait(world: World, runner: Runner, at: number, horizon: number): boolean {
  const lane = world.lanes[runner.row];
  if (!lane || at - runner.lastProgressAt + horizon >= 7800) return false;
  let x = runner.x;
  for (let dt = STEP_MS; dt <= horizon; dt += STEP_MS) {
    if (lane.kind === 'river') x += (lane.direction * lane.speed * STEP_MS) / 1000;
    if (!safeAt(lane, x, at + dt)) return false;
  }
  return true;
}
