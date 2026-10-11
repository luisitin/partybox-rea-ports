// Bots watch the moving platform and choose a timing window; they never read future inputs.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import type { State } from './types';
import { DROP_MS, offsetAt, tolerance } from './world';
import type { Input } from './world';
import { RESTART_MS } from './types';

export function botInput(
  state: State,
  playerId: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (state.phase.id !== 'play' || state.phase.paused) return null;
  const tower = state.towers.find((t) => t.id === playerId);
  if (!tower || !state.players[playerId]?.connected) return null;
  const now = state.checked;
  if (tower.crashedAt !== null)
    return now >= tower.crashedAt + RESTART_MS ? { type: 'restart', attempt: tower.attempt } : null;
  if (now < tower.movingSince + DROP_MS) return null;
  const precision = tolerance(tower);
  const window = skill === 'sharp' ? precision : skill === 'easy' ? 13 : 6;
  if (Math.abs(offsetAt(tower, now, state.course)) > window) return null;
  if (skill === 'easy' && rng.float() < 0.25) return null;
  return { type: 'drop', attempt: tower.attempt, level: tower.height };
}
