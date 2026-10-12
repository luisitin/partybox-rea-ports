// Bots use only the public city: farm edible props, flee larger rims, sharp bots hunt safely.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { isParticipating } from './types';
import type { Input, State } from './types';
import { isAlive, radiusOf } from './world';

export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (
    state.phase.id !== 'play' ||
    state.phase.paused ||
    !isParticipating(state, id) ||
    !state.players[id]?.connected
  )
    return null;
  const me = state.world.holes.find((h) => h.id === id);
  if (!me || !isAlive(me) || me.inputAt === state.world.elapsed) return null;
  const radius = radiusOf(me.mass);
  const threats = state.world.holes.filter(
    (h) =>
      h.id !== id &&
      isAlive(h) &&
      radiusOf(h.mass) >= radius * 1.25 &&
      Math.hypot(h.x - me.x, h.y - me.y) < radiusOf(h.mass) + 14,
  );
  let tx = me.x,
    ty = me.y;
  if (threats.length && skill !== 'easy') {
    const threat = threats.sort(
      (a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y),
    )[0]!;
    tx += me.x - threat.x;
    ty += me.y - threat.y;
  } else {
    const candidates = state.world.props
      .filter((p) => p.availableAt <= state.world.elapsed && p.radius < radius)
      .map((p) => ({ x: p.x, y: p.y, value: p.points / (2 + Math.hypot(p.x - me.x, p.y - me.y)) }));
    if (skill === 'sharp' && !threats.length)
      for (const h of state.world.holes) {
        if (
          h.id !== id &&
          isAlive(h) &&
          h.immuneUntil <= state.world.elapsed &&
          radius >= radiusOf(h.mass) * 1.25
        )
          candidates.push({
            x: h.x,
            y: h.y,
            value: (10 + h.mass / 2) / (5 + Math.hypot(h.x - me.x, h.y - me.y)),
          });
      }
    candidates.sort((a, b) => b.value - a.value);
    const target =
      candidates[
        candidates.length && skill === 'easy' ? rng.int(0, Math.min(5, candidates.length - 1)) : 0
      ];
    if (target) {
      tx = target.x;
      ty = target.y;
    } else {
      tx = rng.int(10, 170);
      ty = rng.int(10, 100);
    }
  }
  const distance = Math.hypot(tx - me.x, ty - me.y);
  const norm = Math.max(1, distance);
  return { type: 'move', x: (tx - me.x) / norm || 0, y: (ty - me.y) / norm || 0 };
}
