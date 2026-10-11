// Three strengths choose open routes toward nearby food; sharp bots look farther ahead.
import type { BotSkill } from '@partybox/game-sdk';
import { angleDelta, distance2, pointSegment2, rounded } from './geometry';
import { H, MIN_MASS, W } from './types';
import type { Input, Point, World } from './types';

export function botInput(world: World, id: string, skill: BotSkill = 'normal'): Input | null {
  const snake = world.snakes.find((s) => s.id === id);
  if (!snake || snake.respawnAt !== null) return null;
  const head = snake.body[0]!;
  const look = skill === 'easy' ? 8 : skill === 'sharp' ? 20 : 14;
  const foods = [...world.food].sort(
    (a, b) => distance2(head, [a.x, a.y]) - distance2(head, [b.x, b.y]),
  );
  const nearest = foods[0];
  const foodAngle = nearest ? Math.atan2(nearest.y - head[1], nearest.x - head[0]) : snake.angle;
  const candidates = [
    snake.target,
    foodAngle,
    Math.atan2(H / 2 - head[1], W / 2 - head[0]),
    snake.angle - 1,
    snake.angle + 1,
    snake.angle + Math.PI,
  ];
  const hazards = world.snakes
    .filter((s) => s.id !== id && s.respawnAt === null && s.safeUntil <= world.elapsed)
    .flatMap((s) => s.body.filter((_, i) => i % 2 === 0));
  let best = snake.target,
    top = -Infinity;
  for (const candidate of candidates) {
    const angle = Math.atan2(Math.sin(candidate), Math.cos(candidate));
    const p: Point = [head[0] + Math.cos(angle) * look, head[1] + Math.sin(angle) * look];
    let clearance = Math.min(p[0], W - p[0], p[1], H - p[1]);
    for (const h of hazards) clearance = Math.min(clearance, Math.sqrt(pointSegment2(h, head, p)));
    const attraction = nearest ? -Math.sqrt(distance2(p, [nearest.x, nearest.y])) / 12 : 0;
    const score =
      Math.min(clearance, 10) * 3 + attraction - Math.abs(angleDelta(snake.angle, angle)) * 2;
    if (score > top) {
      top = score;
      best = angle;
    }
  }
  const angle = Math.max(-Math.PI, Math.min(Math.PI, rounded(best)));
  const boost =
    skill === 'sharp' &&
    top > 20 &&
    snake.mass > MIN_MASS + 8 &&
    Math.abs(angleDelta(snake.angle, angle)) < 0.2 &&
    nearest !== undefined &&
    nearest.value > 1;
  return Math.abs(angleDelta(snake.target, angle)) < 0.04 && snake.boost === boost
    ? null
    : { type: 'steer', angle, boost };
}
