import { hasPlayer } from '@partybox/game-sdk';
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { decision } from './strategy';
import { LEASE_MS } from './types';
import type { Input, State } from './types';

export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (
    state.phase.id !== 'play' ||
    state.phase.paused ||
    !hasPlayer(state, id) ||
    !state.players[id]?.connected ||
    state.left.includes(id)
  )
    return null;
  const me = state.discs.find((disc) => disc.id === id);
  const intent = state.intents[id];
  if (!me || !intent || intent.seq >= 2147483647) return null;
  const reaction = skill === 'easy' ? 300 : skill === 'sharp' ? 150 : 200;
  if (intent.until > 0 && state.clock - (intent.until - LEASE_MS) < reaction) return null;
  // Wait for the pending physics beat rather than issue another packet at its last millisecond.
  if (state.clock >= (state.phase.deadline ?? Infinity) - 1) return null;
  const choice = decision(state, me, skill);
  // A fired held kick needs a real release; no heartbeat may arm it again.
  let kick = choice.kick && !(intent.kickHeld && !intent.kickArmed);
  let { dx, dy } = choice;
  if (skill === 'easy' && rng.chance(0.22)) {
    dx = 0;
    dy = 0;
    kick = false;
  }
  if (skill === 'normal' && rng.chance(0.04)) kick = false;
  return { type: 'control', phaseAt: state.phase.startedAt, seq: intent.seq + 1, dx, dy, kick };
}
