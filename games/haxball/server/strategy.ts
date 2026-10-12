// Strategy reads only public bodies and team membership. Intent bookkeeping is added by bot.ts.
import { attacksRight } from './content';
import { H, KICK_RANGE, W } from './types';
import type { Disc, State } from './types';

export interface Decision {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  kick: boolean;
}
const direction = (distance: number): -1 | 0 | 1 => (distance > 1.6 ? 1 : distance < -1.6 ? -1 : 0);
export const activeDisc = (state: State, disc: Disc): boolean =>
  disc.helper || (!!state.players[disc.id]?.connected && !state.left.includes(disc.id));

export function decision(state: State, me: Disc, skill: 'easy' | 'normal' | 'sharp'): Decision {
  const right = attacksRight(state, me.team);
  const sign = right ? 1 : -1;
  const goalX = right ? W : 0;
  const teammates = state.discs.filter((disc) => disc.team === me.team && activeDisc(state, disc));
  const near = [...teammates].sort(
    (a, b) =>
      Math.hypot(a.x - state.ball.x, a.y - state.ball.y) -
        Math.hypot(b.x - state.ball.x, b.y - state.ball.y) || a.number - b.number,
  );
  const striker = near[0]?.id === me.id;
  const look = skill === 'easy' ? 0 : skill === 'normal' ? 0.15 : 0.3;
  const ballX = Math.max(6, Math.min(W - 6, state.ball.x + state.ball.vx * look));
  const ballY = Math.max(6, Math.min(H - 6, state.ball.y + state.ball.vy * look));
  let x = ballX;
  let y = ballY;
  if (skill !== 'easy' && !striker) {
    // One defender protects the centre; other teammates offer a passing outlet.
    x = me.number === 2 ? (right ? W * 0.17 : W * 0.83) : ballX - sign * 18;
    y = me.number === 2 ? Math.max(28, Math.min(72, ballY)) : ballY + (me.number % 2 ? -18 : 18);
  } else if (skill !== 'easy') {
    // Circle behind the ball before approaching so the radial kick heads toward goal.
    const shotX = goalX - ballX;
    const shotY = H / 2 - ballY;
    const length = Math.hypot(shotX, shotY) || 1;
    const behind = (me.x - ballX) * sign < -1;
    x = behind ? ballX : ballX - (shotX / length) * 8;
    y = behind ? ballY : ballY - (shotY / length) * 8;
  }
  const distance = Math.hypot(me.x - state.ball.x, me.y - state.ball.y);
  const aimed = (state.ball.x - me.x) * sign > 0;
  return {
    dx: direction(Math.max(5, Math.min(W - 5, x)) - me.x),
    dy: direction(Math.max(5, Math.min(H - 5, y)) - me.y),
    kick:
      distance <= KICK_RANGE + (skill === 'easy' ? 0 : 1.5) &&
      (skill === 'easy' || aimed || Math.abs(state.ball.x - goalX) > W * 0.75),
  };
}
