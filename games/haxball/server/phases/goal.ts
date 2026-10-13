import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { GOAL_MS } from '../types';
import type { Goal, Input, State, Transition } from '../types';
import { resetPitch } from '../world';

export function enterGoal(state: State, goal: Goal, now: number): State {
  const after = resetPitch(
    {
      ...state,
      clock: now,
      lastGoal: goal,
      goals: { ...state.goals, [goal.team]: state.goals[goal.team] + 1 },
    },
    now,
  );
  return enterPhase(after, 'goal', now, Math.min(GOAL_MS, Math.max(0, state.halfEndsAt - now)));
}
export function reduceGoal(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
    ? next(state, event.now)
    : state;
}
