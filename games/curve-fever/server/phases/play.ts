// Phase "play": everyone steers on the same clock. `world.tick` judges whatever the worms have done up to now; a steering change is
// applied at its own time. The deadline re-arms every TICK_MS (nextStep, ADR-033), so the round also ends with no one touching
// anything. It ends when one worm is left alive, or at the cap.
import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { ROUND_MS, TICK_MS, apply, finished, tick } from '../world';
import type { Input } from '../world';
import type { State, Transition } from '../types';

const endMs = (state: State): number => state.endsAt - state.began;
const over = (state: State): boolean => state.checked >= endMs(state) || finished(state.world);

/** The next deadline: the next TICK_MS beat after what has been judged, never past the end. */
function wake(state: State): number {
  const beat = (Math.floor(state.checked / TICK_MS) + 1) * TICK_MS;
  return state.began + Math.min(endMs(state), beat);
}

/** The worms are let go: the clock starts now. */
export function enterPlay(state: State, now: number): State {
  const open = enterPhase(
    { ...state, began: now, endsAt: now + ROUND_MS, checked: 0 },
    'play',
    now,
    null,
  );
  return nextStep(settle(open, now), wake(open));
}

/** Judge everything up to `now`. */
export function settle(state: State, now: number): State {
  const to = Math.min(now - state.began, endMs(state));
  if (to <= state.checked && state.world.stepped >= 0) return state;
  return {
    ...state,
    world: tick(state.world, Math.max(0, to)),
    checked: Math.max(state.checked, to),
  };
}

/** What a deadline does: judge up to now, then keep going or finish the round. */
export function advancePlay(state: State, now: number, done: Transition): State {
  const settled = settle(state, now);
  return over(settled) ? done(settled, now) : nextStep(settled, wake(settled));
}

/** The VIP's skip ends the round where it stands. */
export function skipPlay(state: State, now: number, done: Transition): State {
  return done(settle(state, now), now);
}

export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) ? advancePlay(state, event.now, next) : state;
  if (event.type !== 'input' || !hasPlayer(state, event.playerId)) return state;
  const settled = settle(state, event.now);
  if (over(settled)) return next(settled, event.now);
  const world = apply(settled.world, event.playerId, event.input, event.now - settled.began);
  return world === settled.world ? settled : { ...settled, world };
}
