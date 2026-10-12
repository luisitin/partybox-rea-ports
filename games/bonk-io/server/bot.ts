import type { BotSkill, Rng } from '@partybox/game-sdk';
import type { Input, State } from './types';
import { BALL_RADIUS, SHRINK_MS, W, platformsAt } from './world';

/** Honest public-board strategy: attack nearby balls, brake at edges and jump back to a safe platform. */
export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (
    state.phase.id !== 'play' ||
    state.phase.paused ||
    !state.players[id]?.connected ||
    state.left.includes(id)
  )
    return null;
  const me = state.world.balls.find((b) => b.id === id);
  if (!me?.alive) return null;
  if (me.controlAt >= state.checked) return null;
  const rivals = state.world.balls.filter((b) => b.alive && b.id !== id);
  let nearest = rivals[0];
  let distance = Infinity;
  for (const rival of rivals) {
    const gap = Math.hypot(rival.x - me.x, rival.y - me.y);
    if (gap < distance) {
      distance = gap;
      nearest = rival;
    }
  }
  const platforms = platformsAt(state.world.layout, state.checked);
  const floor = platforms.find((p) => p.id === 'floor');
  const ahead = me.x + me.vx * (skill === 'sharp' ? 0.5 : skill === 'easy' ? 0.12 : 0.3);
  const margin = BALL_RADIUS + (skill === 'sharp' ? 30 : 12);
  const nearEdge =
    floor !== undefined && (ahead < floor.x + margin || ahead > floor.x + floor.width - margin);
  let move: -1 | 0 | 1 = nearest ? (nearest.x > me.x ? 1 : -1) : me.x < W / 2 ? 1 : -1;
  let jump = false;
  let heavy = false;
  if (skill === 'easy') {
    // Easy still aims at rivals; it reacts late and occasionally chooses a clumsy jump/hold.
    if (nearEdge && rng.int(0, 3) !== 0) move = me.x < W / 2 ? 1 : -1;
    jump = me.grounded && rng.int(0, 15) === 0;
    heavy = distance < 100 && rng.int(0, 2) === 0;
  } else {
    if (
      nearEdge ||
      (state.checked >= SHRINK_MS && Math.abs(me.x - W / 2) > (floor?.width ?? 0) / 3)
    ) {
      move = me.x < W / 2 ? 1 : -1;
      jump = (me.grounded && Math.abs(me.vx) > 180) || (!me.grounded && me.coyote > 0);
    }
    // A falling ball can still use its brief coyote jump; no bot gets an air jump.
    if (!me.grounded && me.coyote > 0 && me.y > 400 - BALL_RADIUS) jump = true;
    const contactSoon =
      distance < (skill === 'sharp' ? 120 : 86) && Math.abs((nearest?.y ?? me.y) - me.y) < 65;
    heavy = contactSoon && !nearEdge;
    if (contactSoon && me.grounded && rng.int(0, skill === 'sharp' ? 5 : 11) === 0) {
      jump = true;
      heavy = false;
    }
    if (
      skill === 'sharp' &&
      contactSoon &&
      nearest?.heavy &&
      me.grounded &&
      me.vy >= 0 &&
      distance < 85
    ) {
      jump = true;
      heavy = false;
    }
  }
  // A held action needs no duplicate input. Null lets the engine advance to its next deadline.
  if (move === me.move && heavy === me.heavy && !jump) return null;
  return { type: 'control', move, heavy, jump };
}
