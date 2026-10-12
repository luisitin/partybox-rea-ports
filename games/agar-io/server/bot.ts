// Three honest strategies: graze, avoid predators, and make safe split attacks.
import { hasPlayer } from '@partybox/game-sdk';
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { distance, radius, round } from './geometry';
import { EAT_RATIO, SPLIT_MIN, W, H } from './types';
import type { Input, State } from './types';

const TARGET_TIE_TOLERANCE = 0.001;

function nearest<T extends { id: number; x: number; y: number }>(
  me: { x: number; y: number },
  candidates: readonly T[],
  rng: Rng,
): T | undefined {
  let minimum = Infinity;
  const ranked = candidates.map((candidate) => {
    const gap = distance(me, candidate);
    minimum = Math.min(minimum, gap);
    return { candidate, gap };
  });
  const ties = ranked
    .filter(({ gap }) => gap - minimum <= TARGET_TIE_TOLERANCE)
    .sort((a, b) => a.candidate.id - b.candidate.id);
  return ties.length > 1 ? rng.pick(ties).candidate : ties[0]?.candidate;
}

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
  const last = state.world.controls[id];
  if (last && state.world.time > 0 && state.world.time - last.at < 800) return null;
  const own = state.world.cells.filter((c) => c.owner === id);
  const me = [...own].sort((a, b) => b.mass - a.mass || a.id - b.id)[0];
  if (!me) return null;
  const rivals = state.world.cells.filter(
    (c) => c.owner !== id && c.shieldUntil <= state.world.time,
  );
  const threat =
    skill === 'easy'
      ? undefined
      : nearest(
          me,
          rivals.filter((c) => c.mass >= me.mass * EAT_RATIO),
          rng,
        );
  let target: { x: number; y: number } | undefined;
  if (
    skill !== 'easy' &&
    threat &&
    distance(me, threat) < radius(threat.mass) + radius(me.mass) + (skill === 'sharp' ? 22 : 12)
  ) {
    target = { x: me.x + (me.x - threat.x), y: me.y + (me.y - threat.y) };
  } else {
    const prey =
      skill === 'sharp'
        ? nearest(
            me,
            rivals.filter((c) => me.mass >= c.mass * EAT_RATIO),
            rng,
          )
        : undefined;
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
      if (skill === 'easy') {
        const pellets = state.world.pellets
          .map((pellet) => ({ pellet, gap: distance(me, pellet) }))
          .sort((a, b) => a.gap - b.gap || a.pellet.id - b.pellet.id);
        const cutoff = pellets[Math.min(4, pellets.length - 1)]?.gap;
        // Easy varies among five nearby snacks; include all ties at that boundary fairly.
        const choices =
          cutoff === undefined
            ? []
            : pellets
                .filter(({ gap }) => gap - cutoff <= TARGET_TIE_TOLERANCE)
                .sort((a, b) => a.pellet.id - b.pellet.id);
        target = choices.length ? rng.pick(choices).pellet : undefined;
      } else target = nearest(me, state.world.pellets, rng);
    }
  }
  if (!target) return last?.x || last?.y ? { type: 'steer', x: 0, y: 0 } : null;
  let dx = target.x - me.x,
    dy = target.y - me.y;
  // Avoid pinning a fleeing bot against the wall; take a tangent along it.
  const edge = radius(me.mass) + 3;
  if ((me.x < edge && dx < 0) || (me.x > W - edge && dx > 0)) {
    dx = 0;
    dy = me.y < 50 ? 1 : -1;
  }
  if ((me.y < edge && dy < 0) || (me.y > H - edge && dy > 0)) {
    dy = 0;
    dx = me.x < 80 ? 1 : -1;
  }
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const x = dx / length,
    y = dy / length;
  const control = state.world.controls[id];
  const norm = Math.max(1, Math.hypot(x, y));
  return control?.x === round(x / norm) && control?.y === round(y / norm)
    ? null
    : { type: 'steer', x, y };
}
