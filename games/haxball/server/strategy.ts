// Strategy reads only public bodies and team membership. Intent bookkeeping is added by bot.ts.
import { attacksRight } from './content';
import { BALL_R, H, KICK_RANGE, PLAYER_R, W } from './types';
import type { Disc, State } from './types';

export interface Decision {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  kick: boolean;
}
const direction = (distance: number): -1 | 0 | 1 => (distance > 1.6 ? 1 : distance < -1.6 ? -1 : 0);
export const activeDisc = (state: State, disc: Disc): boolean =>
  disc.helper || (!!state.players[disc.id]?.connected && !state.left.includes(disc.id));

interface Vector {
  x: number;
  y: number;
}
const unit = (x: number, y: number): Vector => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

/** Distance from the public ball ray to the nearest opponent in front of it. */
function laneClearance(state: State, me: Disc, aim: Vector, length: number): number {
  let clearance = 24;
  for (const other of state.discs) {
    if (other.team === me.team || !activeDisc(state, other)) continue;
    const x = other.x - state.ball.x;
    const y = other.y - state.ball.y;
    const along = x * aim.x + y * aim.y;
    if (along < 0 || along > length) continue;
    clearance = Math.min(clearance, Math.hypot(x - aim.x * along, y - aim.y * along));
  }
  return clearance;
}

function attackDirection(state: State, me: Disc, skill: 'easy' | 'normal' | 'sharp'): Vector {
  const sign = attacksRight(state, me.team) ? 1 : -1;
  const goalX = sign > 0 ? W : 0;
  // Sharp players inspect three safe lanes through the mouth; normal players aim centrally.
  const targets = skill === 'sharp' ? [H / 2, H / 2 - 10, H / 2 + 10] : [H / 2];
  let shot = unit(sign * Math.max(12, Math.abs(goalX - state.ball.x)), targets[0]! - state.ball.y);
  let clear = laneClearance(state, me, shot, Math.abs(goalX - state.ball.x));
  for (const y of targets.slice(1)) {
    const candidate = unit(sign * Math.max(12, Math.abs(goalX - state.ball.x)), y - state.ball.y);
    const space = laneClearance(state, me, candidate, Math.abs(goalX - state.ball.x));
    if (space > clear + 0.5) {
      shot = candidate;
      clear = space;
    }
  }
  if (laneClearance(state, me, shot, 20) >= PLAYER_R + BALL_R + 2) return shot;

  // A head-on opponent can cancel every radial kick. Dribble into a side lane first.
  // Public roster order gives distinct approach angles without granting either team
  // a fixed kickoff advantage or reading another seat's intent/RNG.
  const identities = state.discs.map((disc) => disc.id).sort();
  const style = identities.indexOf(me.id) / Math.max(1, identities.length - 1);
  const forward = 0.25 + style * 0.45;
  const lateral = Math.sqrt(1 - forward * forward);
  const preferred = state.ball.y >= H / 2 ? -1 : 1;
  const options = [preferred, -preferred].map((side) => ({ x: sign * forward, y: side * lateral }));
  const score = (aim: Vector): number => {
    const nextY = state.ball.y + aim.y * 20;
    const edge = nextY < PLAYER_R + BALL_R || nextY > H - PLAYER_R - BALL_R ? 20 : 0;
    return laneClearance(state, me, aim, 20) - edge;
  };
  return score(options[1]!) > score(options[0]!) + 0.5 ? options[1]! : options[0]!;
}

export function decision(state: State, me: Disc, skill: 'easy' | 'normal' | 'sharp'): Decision {
  const right = attacksRight(state, me.team);
  const sign = right ? 1 : -1;
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
  const aim = attackDirection(state, me, skill);
  const distance = Math.hypot(me.x - state.ball.x, me.y - state.ball.y);
  const alignment =
    distance > 0 ? ((state.ball.x - me.x) * aim.x + (state.ball.y - me.y) * aim.y) / distance : 1;
  const aligned = alignment >= (skill === 'sharp' ? 0.93 : skill === 'normal' ? 0.88 : 0.78);
  if (skill !== 'easy' && !striker) {
    // One defender protects the centre; other teammates offer a passing outlet.
    x = me.number === 2 ? (right ? W * 0.17 : W * 0.83) : ballX - sign * 18;
    y = me.number === 2 ? Math.max(28, Math.min(72, ballY)) : ballY + (me.number % 2 ? -18 : 18);
  } else {
    if (!aligned) {
      // Keep the whole shooting angle, not just the horizontal side of the ball.
      // If we are in front, take a tangent waypoint rather than drive through it.
      x = ballX - aim.x * (KICK_RANGE + 2);
      y = ballY - aim.y * (KICK_RANGE + 2);
      if ((me.x - ballX) * aim.x + (me.y - ballY) * aim.y > -3) {
        const tangent = { x: -aim.y, y: aim.x };
        const side = (me.x - ballX) * tangent.x + (me.y - ballY) * tangent.y >= 0 ? 1 : -1;
        x += tangent.x * side * 8;
        y += tangent.y * side * 8;
      }
    }
  }
  return {
    dx: direction(Math.max(5, Math.min(W - 5, x)) - me.x),
    dy: direction(Math.max(5, Math.min(H - 5, y)) - me.y),
    kick: distance <= KICK_RANGE + (skill === 'easy' ? 0 : 1.5) && aligned,
  };
}
