// Phase "wager": before the final question every player bets 0–100 % of their score (in steps,
// rounded down to a multiple of 10). Exits when every connected player has wagered or after 15 s;
// missing wagers count as 0. Amounts stay hidden from the TV and other phones until the reveal.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { clampWager, wagerAmount } from '../scoring';
import { WAGER_MS, allParticipantsDone, isParticipating } from '../types';
import type { Input, State } from '../types';
import type { Advance } from './intro';
import { wagerReadingMs } from '../pacing';

export function enterWager(state: State, now: number): State {
  const hold = wagerReadingMs(state);
  const duration = Math.max(WAGER_MS, hold);
  return enterPhase(
    { ...state, wagers: {}, wagerClosesAt: now + duration, wagerReadableUntil: now + hold },
    'wager',
    now,
    duration,
  );
}

export function reduceWager(state: State, event: GameEvent<Input>, next: Advance): State {
  if (event.type === 'input') {
    if (event.input.type !== 'wager') return state;
    if (
      !isParticipating(state, event.playerId) ||
      !state.players[event.playerId]?.connected ||
      Object.hasOwn(state.wagers, event.playerId) ||
      event.now < state.phase.startedAt
    )
      return state;
    const closesAt = state.wagerClosesAt ?? state.phase.deadline;
    if (closesAt !== null && event.now >= closesAt) return next(state, event.now);
    const score = state.scores[event.playerId] ?? 0;
    const amount =
      event.input.amount !== undefined
        ? clampWager(score, event.input.amount)
        : wagerAmount(score, event.input.percent ?? 0);
    const wagered: State = { ...state, wagers: { ...state.wagers, [event.playerId]: amount } };
    return finishWagerIfDone(wagered, event.now, next);
  }
  if (
    isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
  )
    return next(state, event.now);
  return state;
}
export function finishWagerIfDone(state: State, now: number, next: Advance): State {
  if (!allParticipantsDone(state, Object.keys(state.wagers))) return state;
  const readableUntil = state.wagerReadableUntil ?? state.phase.startedAt;
  if (now >= readableUntil) return next(state, now);
  return state.phase.deadline === readableUntil
    ? state
    : { ...state, phase: { ...state.phase, deadline: readableUntil } };
}
