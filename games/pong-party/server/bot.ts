// Bots intercept the nearest incoming ball, predicting bounces off empty sides.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import type { State } from './types';
import { firstCollision, PADDLE_HALF } from './world';
import type { Ball, Input, Paddle, World } from './world';

function threat(
  world: World,
  seat: Paddle,
  ball: Ball,
  horizon: number,
): { time: number; position: number } | null {
  let future = { ...ball };
  let elapsed = 0;
  for (let bounce = 0; bounce < 5; bounce++) {
    const collision = firstCollision(future, horizon - elapsed);
    if (!collision) return null;
    const { edge, time } = collision;
    elapsed += time;
    future.x += future.vx * time;
    future.y += future.vy * time;
    if (edge.slot === seat.slot) {
      const along = (future.x - edge.mx) * edge.tx + (future.y - edge.my) * edge.ty;
      return {
        time: elapsed,
        position: Math.max(0, Math.min(1, (along / (edge.length / 2 - PADDLE_HALF) + 1) / 2)),
      };
    }
    // Another player's save changes the outgoing angle; do not invent its outcome.
    if (world.paddles.some((p) => p.slot === edge.slot && p.lives > 0)) return null;
    const dot = future.vx * edge.nx + future.vy * edge.ny;
    future.vx -= 2 * dot * edge.nx;
    future.vy -= 2 * dot * edge.ny;
    future.x -= edge.nx * 0.000002;
    future.y -= edge.ny * 0.000002;
  }
  return null;
}

export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (state.phase.id !== 'play' || state.phase.paused) return null;
  const seat = state.world.paddles.find((p) => p.id === id);
  if (!seat || seat.lives <= 0 || seat.movedAt === state.world.stepped) return null;
  const horizon = skill === 'easy' ? 1.1 : skill === 'sharp' ? 4 : 2.5;
  const threats = state.world.balls
    .filter((b) => b.readyAt <= state.checked)
    .map((b) => threat(state.world, seat, b, horizon))
    .filter((t): t is { time: number; position: number } => t !== null)
    .sort((a, b) => a.time - b.time);
  let target = threats[0]?.position ?? 0.5;
  if (threats.length > 0) {
    const error = skill === 'easy' ? 0.14 : skill === 'sharp' ? 0 : 0.035;
    target += (rng.float() * 2 - 1) * error;
  }
  const reach = skill === 'easy' ? 0.12 : skill === 'sharp' ? 0.65 : 0.3;
  const position = Math.max(
    0,
    Math.min(1, seat.position + Math.max(-reach, Math.min(reach, target - seat.position))),
  );
  return Math.abs(position - seat.position) < 0.0001 ? null : { type: 'move', position };
}
