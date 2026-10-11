// Three honest strategies: graze, avoid predators, and make safe split attacks.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { distance, radius, round } from './geometry';
import { EAT_RATIO, SPLIT_MIN } from './types';
import type { Input, State } from './types';

export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (state.phase.id !== 'play' || state.phase.paused || state.left.includes(id)) return null;
  const own = state.world.cells.filter((c) => c.owner === id);
  const me = [...own].sort((a, b) => b.mass - a.mass)[0];
  if (!me) return null;
  const rivals = state.world.cells.filter(
    (c) => c.owner !== id && c.shieldUntil <= state.world.time,
  );
  const threat = rivals
    .filter((c) => c.mass >= me.mass * EAT_RATIO)
    .sort((a, b) => distance(me, a) - distance(me, b))[0];
  let target: { x: number; y: number } | undefined;
  if (
    skill !== 'easy' &&
    threat &&
    distance(me, threat) < radius(threat.mass) + radius(me.mass) + (skill === 'sharp' ? 22 : 12)
  ) {
    target = { x: me.x + (me.x - threat.x), y: me.y + (me.y - threat.y) };
  } else {
    const prey = rivals
      .filter((c) => me.mass >= c.mass * EAT_RATIO)
      .sort((a, b) => distance(me, a) - distance(me, b))[0];
    if (skill === 'sharp' && prey && distance(me, prey) < 25) {
      const control = state.world.controls[id];
      const dx = prey.x - me.x,
        dy = prey.y - me.y;
      const aiming = control && control.x * dx + control.y * dy > Math.hypot(dx, dy) * 0.9;
      if (
        aiming &&
        me.mass >= SPLIT_MIN &&
        me.mass / 2 >= prey.mass * EAT_RATIO &&
        distance(me, prey) > radius(me.mass) &&
        distance(me, prey) < 17 &&
        own.length < 4 &&
        state.world.time - control.splitAt >= 1000 &&
        rng.chance(0.75)
      )
        return { type: 'split' };
      target = prey;
    } else {
      const pellets = [...state.world.pellets].sort((a, b) => distance(me, a) - distance(me, b));
      target = pellets[skill === 'easy' ? rng.int(0, Math.min(4, pellets.length - 1)) : 0];
    }
  }
  if (!target) return { type: 'steer', x: 0, y: 0 };
  let dx = target.x - me.x,
    dy = target.y - me.y;
  // Avoid pinning a fleeing bot against the wall; take a tangent along it.
  if ((me.x < 6 && dx < 0) || (me.x > 154 && dx > 0)) {
    dx = 0;
    dy = me.y < 50 ? 1 : -1;
  }
  if ((me.y < 6 && dy < 0) || (me.y > 94 && dy > 0)) {
    dy = 0;
    dx = me.x < 80 ? 1 : -1;
  }
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const x = dx / length, y = dy / length;
  const control = state.world.controls[id];
  const norm = Math.max(1, Math.hypot(x,y));
  return control?.x === round(x/norm) && control?.y === round(y/norm) ? null : { type: 'steer', x, y };
}
