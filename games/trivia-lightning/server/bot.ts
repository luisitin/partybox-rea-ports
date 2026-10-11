// Bots know authored facts, read only their visible question, and spend power tactically.
import { hasPlayer } from '@partybox/game-sdk';
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { KNOWLEDGE } from './knowledge';
import type { Input, State } from './types';

export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (
    state.phase.id !== 'race' ||
    state.phase.paused ||
    !hasPlayer(state, id) ||
    !state.players[id]?.connected ||
    state.left.includes(id)
  )
    return null;
  const r = state.runners[id]!;
  if (r.answered >= state.deck.length || r.freezeUntil > state.clock) return null;
  if (state.cfg.powers && r.energy > 0 && !r.double) {
    const rival = Object.entries(state.runners)
      .filter(
        ([pid, other]) =>
          pid !== id &&
          state.players[pid]?.connected &&
          !state.left.includes(pid) &&
          other.answered < state.deck.length &&
          other.freezeUntil <= state.clock,
      )
      .sort((a, b) => b[1].score - a[1].score)[0];
    if (
      skill === 'sharp' &&
      rival &&
      rival[1].score > r.score &&
      r.answered + 2 < state.deck.length
    )
      return { type: 'power', power: 'freeze', target: rival[0] };
    return { type: 'power', power: 'double' };
  }
  if (r.feedback) return { type: 'next', index: r.answered };
  const q = state.deck[r.answered];
  if (!q) return null;
  const known = q.options.indexOf(KNOWLEDGE[q.prompt] ?? '');
  const probability = skill === 'easy' ? 0.4 : skill === 'sharp' ? 0.94 : 0.7;
  const choice = known >= 0 && rng.float() < probability ? known : rng.int(0, 3);
  return { type: 'answer', questionId: q.id, index: r.answered, choice };
}
