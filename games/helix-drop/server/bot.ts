// Align the next gap along the shortest arc. Stronger bots aim sooner and make fewer errors.
import { hasPlayer } from '@partybox/game-sdk';
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { angleDifference } from './content';
import { HOLD_MS } from './types';
import type { Input, State } from './types';

export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (state.phase.id !== 'play' || state.phase.paused || !hasPlayer(state, id)) return null;
  const runner = state.runners.find((r) => r.id === id);
  if (
    !runner ||
    runner.lives <= 0 ||
    runner.cleared ||
    runner.respawnAt !== null ||
    !state.players[id]?.connected
  )
    return null;
  if (runner.heldUntil - HOLD_MS >= state.checked) return null;
  const ring = state.tower[runner.floor];
  if (!ring) return null;
  const error = angleDifference(-ring.gap, runner.angle);
  const tolerance = skill === 'sharp' ? 10 : skill === 'easy' ? 32 : 20;
  if (rng.chance(skill === 'easy' ? 0.14 : skill === 'normal' ? 0.04 : 0))
    return { type: 'rotate', dir: rng.pick([-1, 0, 1] as const) };
  return { type: 'rotate', dir: Math.abs(error) <= tolerance ? 0 : error > 0 ? 1 : -1 };
}
