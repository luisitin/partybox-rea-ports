// Discussion exposes the question but accepts no answer until the real answer clock opens.
import { enterPhase, isTimerFor } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { groupTalkMs } from '../pacing';
import type { Input, State } from '../types';
import type { Advance } from './intro';

export function enterTalk(state: State, now: number): State {
  const { roomDecision: _decision, roomElapsedMs: _elapsed, ...prior } = state;
  const asking: State = {
    ...prior,
    index: Math.min(state.index + 1, state.questionIds.length - 1),
    picks: {},
    lastDelta: {},
    teamGains: {},
  };
  const duration = Math.max((state.settings.talkSeconds ?? 5) * 1000, groupTalkMs(asking));
  return enterPhase(asking, 'talk', now, duration);
}

export function reduceTalk(state: State, event: GameEvent<Input>, next: Advance): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
