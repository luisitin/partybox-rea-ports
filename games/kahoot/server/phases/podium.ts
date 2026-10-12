// Third, second, then first. The server reveals each rank tier, including shared ranks.
import { enterPhase, isTimerFor, nextStep, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { standings } from '../scoring';
import { PODIUM_MS } from '../types';
import type { Input, State, Transition } from '../types';

const PODIUM_SETTLE_MS = 600;

function podiumMs(state: State): number {
  const rank = 3 - state.podiumStep;
  const beat = rank === 3 ? 'Third place' : rank === 2 ? 'Second place' : 'First place';
  const visible = standings(state).filter((p) => p.rank <= 3 && p.rank >= rank);
  const stage = [
    `The podium ${beat} 2nd 1st 3rd`,
    ...visible.map((p) => `${p.name} ${p.score} points`),
  ].join(' ');
  const phone = `The podium ${beat} The final places are being revealed`;
  const words = Math.max(wordCount(stage), wordCount(phone));
  return Math.max(PODIUM_MS, PODIUM_SETTLE_MS + readingMs(words, { ui: true }));
}

export function enterPodium(state: State, now: number): State {
  const ranks = standings(state).map((r) => r.rank);
  const first = [3, 2, 1].find((rank) => ranks.includes(rank)) ?? 1;
  const after = { ...state, podiumStep: 3 - first };
  return enterPhase(after, 'podium', now, podiumMs(after));
}
export function stepPodium(state: State, now: number, done: Transition): State {
  const ranks = standings(state).map((r) => r.rank);
  const next = [3, 2, 1].find((rank) => rank < 3 - state.podiumStep && ranks.includes(rank));
  if (next === undefined) return done(state, now);
  const after = { ...state, podiumStep: 3 - next };
  return nextStep(after, now + podiumMs(after));
}
export function reducePodium(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
