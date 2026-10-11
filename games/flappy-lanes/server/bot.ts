// A three-strength pilot tracks the visible opening and predicts the short fall before tapping.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import type { State } from './types';
import { COOLDOWN_MS, GATE_WIDTH, SPEED, X, birdPosition, visibleGates } from './world';
import type { Input } from './world';

export function botInput(
  state: State,
  playerId: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (state.phase.id !== 'play' || state.phase.paused) return null;
  const bird = state.world.birds.find((b) => b.id === playerId);
  if (!bird || bird.died !== null || state.world.checked - bird.lastFlap < COOLDOWN_MS) return null;
  const t = state.world.checked;
  const gate = visibleGates(state.world).find((g) => g.x + GATE_WIDTH - (SPEED * t) / 1000 >= X);
  const target = gate?.center ?? 50;
  const look = skill === 'sharp' ? 180 : skill === 'easy' ? 50 : 140;
  const aim =
    target + (skill === 'easy' ? rng.int(-9, 9) : skill === 'normal' ? rng.int(-2, 2) : 0);
  const predicted = birdPosition(bird, t + look);
  const current = birdPosition(bird, t);
  if (current.v < -8 || predicted.y < aim + 3) return null;
  if (skill === 'easy' && rng.float() < 0.12) return null;
  return { type: 'flap' };
}
