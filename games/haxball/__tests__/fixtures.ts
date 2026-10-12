import { game } from '../server/index';
import { enterGoal } from '../server/phases/goal';
import { enterHalftime } from '../server/phases/halftime';
import { BALL_R, H, W } from '../server/types';
import type { State, Team } from '../server/types';
import { body, control, copy, finishIdle, start, timer, T0 } from './helpers';

function scored(state: State, team: Team, scorerId: string): State {
  const right = (team === 'red') === state.redAttacksRight;
  return timer(
    {
      ...copy(state),
      ball: body(right ? W + BALL_R - 0.5 : -BALL_R + 0.5, H / 2, right ? 40 : -40),
      discs: state.discs.map((disc, i) => ({ ...disc, x: 30 + i * 12, y: 15, vx: 0, vy: 0 })),
      lastTouch: scorerId,
    },
    state.clock + 100,
  );
}

export function fixtures(): Record<string, State> {
  const play = start();
  const red = play.discs.find((disc) => disc.team === 'red')!;
  const blue = play.discs.find((disc) => disc.team === 'blue')!;
  const armed = control(play, 'p1', { kick: true }, T0);
  const goal = enterGoal(
    { ...copy(play), goals: { red: 2, blue: 2 } },
    { team: 'red', scorerId: red.id, ownGoal: false },
    T0 + 25_000,
  );
  const ownGoal = enterGoal(
    copy(play),
    { team: 'red', scorerId: blue.id, ownGoal: true },
    T0 + 10_000,
  );
  // Keep the actual half cap while the reducer scores and consumes its reset.
  // The all-wide 64-character name also stresses the active phone's own header.
  const afterGoal = timer(scored(play, 'red', red.id));
  const longPlay = copy(play);
  longPlay.players['p1']!.name = 'W'.repeat(64);
  const ownTeam = longPlay.discs.find((disc) => disc.id === 'p1')!.team;
  const afterOwnLong = timer(scored(longPlay, ownTeam === 'red' ? 'blue' : 'red', 'p1'));
  const halfOwnLong = timer(afterOwnLong, afterOwnLong.halfEndsAt);
  const halftime = enterHalftime({ ...copy(play), goals: { red: 1, blue: 1 } }, play.halfEndsAt);
  // Reach the real second-half instance, then retain its late live state. The
  // SDK's 500-step fixture finisher need not replay a whole 90-second half.
  const secondHalf = timer(timer(copy(play), play.halfEndsAt));
  const last: State = timer(
    {
      ...secondHalf,
      goals: { red: 3, blue: 2 },
      lastGoal: { team: 'red', scorerId: red.id, ownGoal: false },
    },
    secondHalf.halfEndsAt - 1000,
  );
  const paused = game.reduce(armed, { type: 'vip', now: T0 + 100, action: 'pause' });
  const left = game.reduce(play, {
    type: 'player',
    now: T0 + 100,
    playerId: 'p1',
    connected: false,
    gone: 'left',
  });
  return {
    play,
    goal,
    halftime,
    'play-last': last,
    done: finishIdle(last),
    'play-odd': start(7, 3),
    'play-kick-armed': armed,
    'play-paused': paused,
    'play-left': left,
    'goal-own': ownGoal,
    'play-last-goal': afterGoal,
    'play-last-own-long': afterOwnLong,
    'halftime-last-own-long': halfOwnLong,
    'done-last-own-long': finishIdle(halfOwnLong),
    'done-draw': finishIdle({ ...copy(last), goals: { red: 0, blue: 0 }, lastGoal: null }),
  };
}
