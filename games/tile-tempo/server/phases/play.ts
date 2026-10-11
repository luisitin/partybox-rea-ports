// The clock is shared; each phone advances only its own row. Row ids reject duplicate taps.
import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { PLAY_MS, TICK_MS } from '../types';
import { makeSequence } from '../content';
import type { Input, State, Transition } from '../types';

export function enterPlay(state: State, now: number): State {
  return enterPhase(
    { ...state, began: now, endsAt: now + PLAY_MS, elapsed: 0 },
    'play',
    now,
    TICK_MS,
  );
}
export function settle(state: State, now: number): State {
  const elapsed = Math.max(state.elapsed, Math.min(PLAY_MS, Math.max(0, now - state.began)));
  return elapsed === state.elapsed ? state : { ...state, elapsed };
}
export function allOut(state: State): boolean {
  return Object.values(state.runs).every((run) => run.out);
}
export function advancePlay(state: State, now: number, next: Transition): State {
  const judged = settle(state, now);
  return now >= state.endsAt || allOut(judged)
    ? next(judged, now)
    : nextStep(judged, Math.min(state.endsAt, state.began + judged.elapsed + TICK_MS));
}
export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer') {
    return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
      ? advancePlay(state, event.now, next)
      : state;
  }
  if (event.type !== 'input' || !hasPlayer(state, event.playerId)) return state;
  const run = state.runs[event.playerId];
  if (!run || run.out || !state.players[event.playerId]?.connected) return state;
  if (event.now < state.began || (run.lastAt !== null && event.now < run.lastAt)) return state;
  if (event.now >= state.endsAt) return next(settle(state, event.now), event.now);
  if (event.input.type !== 'tap' || event.input.row !== run.tiles) return state;
  if (!Number.isInteger(event.input.column) || event.input.column < 0 || event.input.column > 3)
    return state;
  const note = state.sequence[run.tiles];
  if (note === undefined) return state;
  const correct = event.input.column === note;
  let changed: State = {
    ...settle(state, event.now),
    runs: {
      ...state.runs,
      [event.playerId]: {
        tiles: run.tiles + (correct ? 1 : 0),
        out: !correct,
        wrongColumn: correct ? null : event.input.column,
        lastAt: event.now,
      },
    },
  };
  // Grow the shared track only when needed; fast hands never run out of notes.
  if (correct && changed.sequence.length - run.tiles < 5) {
    const [tail, rng] = makeSequence(changed.rng);
    changed = { ...changed, sequence: [...changed.sequence, ...tail], rng };
  }
  return allOut(changed) ? next(changed, event.now) : changed;
}
