import { game } from '../server/index';
import { enterGoal } from '../server/phases/goal';
import { enterHalftime } from '../server/phases/halftime';
import type { State } from '../server/types';
import { control, copy, finishIdle, start, timer, T0 } from './helpers';

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
    'done-draw': finishIdle({ ...copy(last), goals: { red: 0, blue: 0 }, lastGoal: null }),
  };
}
