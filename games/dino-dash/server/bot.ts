import type { BotSkill, Rng } from '@partybox/game-sdk';
import type { State } from './types';
import { JUMP_MS, RUNNER_WIDTH, RUNNER_X, distanceAt, speedAt, visibleCourse } from './world';
import type { Input } from './world';

/** Reacts only to the obstacle a player can see. Skill changes timing and missed reactions. */
export function botInput(
  state: State,
  playerId: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  const runner = state.world.runners.find((r) => r.id === playerId);
  if (
    state.phase.id !== 'play' ||
    state.phase.paused ||
    !runner ||
    runner.died !== null ||
    !state.players[playerId]?.connected
  )
    return null;
  const distance = distanceAt(state.world.checked);
  const obstacle = visibleCourse(state.world).find((o) => o.x + o.width > distance + RUNNER_X);
  if (!obstacle) return runner.duck ? { type: 'duck', down: false } : null;
  const gap = obstacle.x - distance - RUNNER_X - RUNNER_WIDTH;
  const seconds = gap / speedAt(state.world.checked);
  if (obstacle.kind === 'bird') {
    if (runner.duck) return null;
    if (seconds < 0.5 && (skill !== 'easy' || rng.float() > 0.35))
      return { type: 'duck', down: true };
    return null;
  }
  if (runner.duck) return { type: 'duck', down: false };
  if (runner.jumpAt !== null && state.world.checked - runner.jumpAt < JUMP_MS) return null;
  const reaction = skill === 'sharp' ? 0.3 : skill === 'easy' ? 0.25 : 0.26;
  const missChance = skill === 'easy' ? 0.4 : skill === 'normal' ? 0.08 : 0;
  return seconds < reaction && (missChance === 0 || rng.float() >= missChance)
    ? { type: 'jump' }
    : null;
}
