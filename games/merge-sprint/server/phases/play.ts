// The live race: exact-deadline closure, versioned inputs and one spawn per legal move.
import { allConnectedDone, hasPlayer, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent, Transition } from '@partybox/game-sdk';
import { canMove, slide, spawn } from '../board';
import { MAX_MOVES, MOVE_MS, TARGET } from '../types';
import type { Input, State } from '../types';

export function raceFinished(state: State): boolean {
  return allConnectedDone(
    state,
    Object.entries(state.racers)
      .filter(([, r]) => r.status !== 'racing')
      .map(([id]) => id),
  );
}

export function reducePlay(state: State, event: GameEvent<Input>, next: Transition<State>): State {
  if (isTimerFor(state, event))
    return state.phase.deadline !== null && event.now >= state.phase.deadline
      ? next({ ...state, reason: 'clock' }, event.now)
      : state;
  if (event.type !== 'input' || !hasPlayer(state, event.playerId)) return state;
  const racer = state.racers[event.playerId];
  if (!racer || !state.players[event.playerId]?.connected || racer.status !== 'racing')
    return state;
  if (state.phase.deadline !== null && event.now >= state.phase.deadline)
    return next({ ...state, reason: 'clock' }, event.now);
  if (
    event.now < state.phase.startedAt ||
    event.now - racer.lastAt < MOVE_MS ||
    event.input.move !== racer.moves
  )
    return state;
  const moved = slide(racer.board, event.input.dir);
  if (!moved.changed) return state;
  const draw = state.spawns[racer.moves + 2];
  if (!draw) return state;
  const board = spawn(moved.board, draw);
  const won = Math.max(...board) >= TARGET;
  const moves = racer.moves + 1;
  const status = won ? 'finished' : !canMove(board) || moves >= MAX_MOVES ? 'blocked' : 'racing';
  const fresh: State = {
    ...state,
    racers: {
      ...state.racers,
      [event.playerId]: {
        board,
        score: racer.score + moved.gain,
        moves,
        lastAt: event.now,
        status,
      },
    },
  };
  if (won) return next({ ...fresh, reason: 'target' }, event.now);
  return raceFinished(fresh) ? next({ ...fresh, reason: 'blocked' }, event.now) : fresh;
}
