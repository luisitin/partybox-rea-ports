// Phase "wager": before the final question every player bets 0–100 % of their score (in steps,
// rounded down to a multiple of 10). Exits when every connected player has wagered or after 15 s;
// missing wagers count as 0. Amounts stay hidden from the TV and other phones until the reveal.
import { allConnectedDone, enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { clampWager, wagerAmount } from '../scoring';
import { WAGER_MS, isPlayer } from '../types';
import type { Input, State } from '../types';
import type { Advance } from './intro';

export function enterWager(state: State, now: number): State {
  return enterPhase({ ...state, wagers: {} }, 'wager', now, WAGER_MS);
}

export function reduceWager(state: State, event: GameEvent<Input>, next: Advance): State {
  if (event.type === 'input') {
    if (event.input.type !== 'wager') return state;
    if (!isPlayer(state, event.playerId) || Object.hasOwn(state.wagers, event.playerId))
      return state;
    const score = state.scores[event.playerId] ?? 0;
    const amount =
      event.input.amount !== undefined
        ? clampWager(score, event.input.amount)
        : wagerAmount(score, event.input.percent ?? 0);
    const wagered: State = { ...state, wagers: { ...state.wagers, [event.playerId]: amount } };
    return allConnectedDone(wagered, Object.keys(wagered.wagers))
      ? next(wagered, event.now)
      : wagered;
  }
  if (isTimerFor(state, event)) return next(state, event.now);
  return state;
}
