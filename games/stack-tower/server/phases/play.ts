// One shared clock, independent towers. Timers publish observation time for bots.
import { hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent, Transition } from '@partybox/game-sdk';
import type { State } from '../types';
import { TICK_MS } from '../types';
import { drop, restart } from '../world';
import type { Input } from '../world';

export function reducePlay(state: State, event: GameEvent<Input>, next: Transition<State>): State {
  if (event.type === 'timer') {
    if (!isTimerFor(state, event) || event.now < state.phase.deadline!) return state;
    if (event.now >= state.endsAt) return next(state, state.endsAt);
    return nextStep(
      { ...state, checked: Math.max(state.checked, event.now) },
      Math.min(state.endsAt, event.now + TICK_MS),
    );
  }
  if (event.type !== 'input' || !hasPlayer(state, event.playerId)) return state;
  if (!state.players[event.playerId]?.connected || event.now < state.checked) return state;
  if (event.now >= state.endsAt) return next(state, state.endsAt);
  const tower = state.towers.find((t) => t.id === event.playerId);
  if (!tower || event.input.attempt !== tower.attempt) return state;
  if (event.input.type === 'drop' && event.input.level !== tower.height) return state;
  const updated =
    event.input.type === 'restart'
      ? restart(tower, event.now)
      : drop(tower, event.now, state.course);
  if (updated === tower) return state;
  return {
    ...state,
    checked: Math.max(state.checked, event.now),
    towers: state.towers.map((t) => (t.id === tower.id ? updated : t)),
    scores: { ...state.scores, [tower.id]: updated.best },
  };
}
