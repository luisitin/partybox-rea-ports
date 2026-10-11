// Bots read the same current note as a phone, with skill-dependent pace and occasional slips.
import { hasPlayer } from '@partybox/game-sdk';
import type { BotSkill, Rng } from '@partybox/game-sdk';
import type { Input, State } from './types';

export function sampleInput(state: State, id: string, rng: Rng, skill?: BotSkill): Input | null {
  if (state.phase.id !== 'play' || state.phase.paused || !hasPlayer(state, id)) return null;
  const run = state.runs[id];
  if (!run || run.out || !state.players[id]?.connected) return null;
  const strength = skill ?? state.botSkill;
  const interval = strength === 'sharp' ? 180 : strength === 'easy' ? 620 : 350;
  const judgedAt = state.began + state.elapsed;
  if (judgedAt - (run.lastAt ?? state.began) < interval) return null;
  const note = state.sequence[run.tiles];
  if (note === undefined || judgedAt >= state.endsAt) return null;
  const slip = strength === 'sharp' ? 0.001 : strength === 'easy' ? 0.015 : 0.005;
  return {
    type: 'tap',
    column: rng.float() < slip ? (note + rng.int(1, 3)) % 4 : note,
    row: run.tiles,
  };
}
