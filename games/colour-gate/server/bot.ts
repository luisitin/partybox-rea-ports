// Bots hover safely and predict the crossing under an impulse; stronger seats misjudge less often.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { GRAVITY, IMPULSE, TAP_MS } from './types';
import type { Input, State } from './types';
import { gateColour } from './world';

export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  const runner = state.world.runners.find((r) => r.id === id);
  const t = state.world.checked;
  if (
    state.phase.id !== 'play' ||
    state.phase.paused ||
    !runner ||
    !state.players[id]?.connected ||
    runner.respawnAt !== null ||
    t - runner.lastTap < TAP_MS
  )
    return null;
  const gate = state.world.gates[runner.gates];
  if (!gate) return null;
  const distance = gate.height - runner.y;
  const discriminant = IMPULSE * IMPULSE - 2 * GRAVITY * distance;
  const reaches = discriminant >= 0;
  const crossing = reaches ? ((IMPULSE - Math.sqrt(discriminant)) / GRAVITY) * 1000 : 0;
  const matches = reaches && gateColour(gate, t + Math.ceil(crossing / 20) * 20) === runner.colour;
  const danger = runner.y - runner.floor < 18 && runner.velocity < 25;
  const hover = !reaches && runner.velocity < 55;
  if (!(danger || hover || matches)) return null;
  const error = skill === 'easy' ? 0.22 : skill === 'sharp' ? 0.01 : 0.06;
  return rng.float() < error ? null : { type: 'tap' };
}
