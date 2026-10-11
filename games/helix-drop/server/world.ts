// Fixed 20-ms integration: splitting time into different event batches cannot change collisions.
import { angleDifference, freshRunner, wrap } from './content';
import { BOUNCE, GRAVITY, MAX_FALL, RESPAWN_MS, ROTATION_SPEED, STEP_MS } from './types';
import type { Ring, Runner, State } from './types';

/** The ball has a four-degree margin at either opening edge. Danger includes its boundary. */
export function surfaceAt(ring: Ring, rotation: number): 'gap' | 'safe' | 'danger' {
  if (Math.abs(angleDifference(0, ring.gap + rotation)) < ring.width / 2 - 4) return 'gap';
  if (
    ring.dangerWidth > 0 &&
    Math.abs(angleDifference(0, ring.danger + rotation)) <= ring.dangerWidth / 2 + 4
  )
    return 'danger';
  return 'safe';
}

export function stepRunner(runner: Runner, tower: Ring[], at: number): Runner {
  if (runner.cleared || runner.lives <= 0) return runner;
  if (runner.respawnAt !== null) {
    if (at < runner.respawnAt) return runner;
    return {
      ...freshRunner(runner.id, runner.lives),
      best: runner.best,
      crashed: runner.crashed,
      smashes: runner.smashes,
    };
  }
  const dir = at <= runner.heldUntil ? runner.dir : 0;
  const angle = wrap(runner.angle + (dir * ROTATION_SPEED * STEP_MS) / 1000);
  const vy = Math.min(MAX_FALL, runner.vy + (GRAVITY * STEP_MS) / 1000);
  const y = runner.y + (vy * STEP_MS) / 1000;
  const moved: Runner = { ...runner, angle, dir, y, vy };
  if (vy <= 0 || y < runner.floor) return moved;
  const ring = tower[runner.floor];
  if (!ring) return { ...moved, cleared: true, dir: 0 };
  const surface = surfaceAt(ring, angle);
  const smash = runner.chain >= 3 && surface !== 'gap';
  if (surface === 'gap' || smash) {
    const floor = runner.floor + 1;
    return {
      ...moved,
      floor,
      best: Math.max(runner.best, floor),
      chain: smash ? 0 : runner.chain + 1,
      smashes: runner.smashes + (smash ? 1 : 0),
      cleared: floor >= tower.length,
      dir: floor >= tower.length ? 0 : dir,
    };
  }
  if (surface === 'danger') {
    const lives = runner.lives - 1;
    return {
      ...moved,
      y: runner.floor,
      vy: 0,
      chain: 0,
      dir: 0,
      heldUntil: 0,
      lives,
      crashed: runner.crashed + 1,
      respawnAt: lives > 0 ? at + RESPAWN_MS : null,
    };
  }
  return { ...moved, y: runner.floor, vy: BOUNCE, chain: 0 };
}

/** Bounded by the round cap even if a timer arrives very late. */
export function settle(state: State, now: number): State {
  const to = Math.floor(Math.max(0, Math.min(now, state.endsAt) - state.began) / STEP_MS) * STEP_MS;
  if (to <= state.checked) return state;
  let runners = state.runners;
  for (let at = state.checked + STEP_MS; at <= to; at += STEP_MS)
    runners = runners.map((r) => stepRunner(r, state.tower, at));
  return { ...state, runners, checked: to };
}

export const allFinished = (state: State): boolean =>
  state.runners.every((r) => r.lives <= 0 || r.cleared);
