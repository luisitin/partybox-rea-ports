// Aim at reachable visible landing surfaces, using the same wrapped geometry as phones.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { GRAVITY, SPEED } from './types';
import type { Input, State } from './types';
import { deltaX, visiblePlatforms } from './world';

export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  const c = state.world.climbers.find((p) => p.id === id);
  if (state.phase.id !== 'play' || !c || c.died !== null || !state.players[id]?.connected)
    return null;
  // A bot reads only its own camera and never sees the ungenerated/future route.
  const apex = c.y + Math.max(0, c.vy) ** 2 / (2 * GRAVITY);
  const options = visiblePlatforms(state.world.platforms, c.camera).filter(
    (p) => p.y <= apex - 2 && p.y >= c.y - 100,
  );
  const ranked = options
    .map((p) => {
      const discriminant = c.vy ** 2 + 2 * GRAVITY * (c.y - p.y);
      const time = discriminant >= 0 ? (c.vy + Math.sqrt(discriminant)) / GRAVITY : 0;
      const distance = Math.abs(deltaX(c.x, p.x));
      const reachable = time > 0 && distance <= SPEED * time + p.width / 2;
      return {
        p,
        time,
        distance,
        merit: reachable ? p.y + (p.kind === 'spring' ? 25 : 0) - distance * 0.15 : -Infinity,
      };
    })
    .sort((a, b) => b.merit - a.merit);
  const target = ranked[0];
  if (!target || !Number.isFinite(target.merit))
    return c.dir === 0 ? null : { type: 'steer', dir: 0 };
  let dx = deltaX(c.x, target.p.x);
  if (skill === 'easy') dx += rng.int(-25, 25);
  const tolerance = skill === 'sharp' ? Math.max(4, target.p.width / 2 - 10) : 8;
  const dir = Math.abs(dx) <= tolerance ? 0 : dx < 0 ? -1 : 1;
  // The host asks again after a null. An unchanged hold must not consume its event budget.
  return dir === c.dir ? null : { type: 'steer', dir };
}
