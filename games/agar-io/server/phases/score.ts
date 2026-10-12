// The arena freezes at the horn while the room sees round mass and banked totals.
import { enterPhase, isTimerFor, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { roundPoints } from '../scoring';
import { SCORE_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { release } from '../world';

/** Counts the complete TV/phone score summary; repeated arena labels are absent. */
function scoreHold(state: State): number {
  const players = Object.entries(state.players);
  const next = state.round >= 3 ? 'Final results' : 'Next round';
  // A connection event can add a Left/Offline badge after this phase begins. Reserve its
  // one word for every seat so a delayed horn leave or later drop cannot outrun the hold.
  const tvRows = players.map(
    ([id, p], slot) =>
      `${slot + 1} ${p.name} Offline +${state.lastPoints[id] ?? 0} ${state.scores[id] ?? 0}`,
  );
  const phoneRows = players.map(([id, p], slot) => {
    const total = state.scores[id] ?? 0;
    const rank = 1 + Object.values(state.scores).filter((n) => n > total).length;
    return `${rank} ${slot + 1} ${p.name} Offline +${state.lastPoints[id] ?? 0} ${total}`;
  });
  const phoneCommon = [`Round ${state.round} over`, 'Place / player Round / total', ...phoneRows];
  const phoneScreens = [
    [...phoneCommon, `Mass at the buzzer becomes points. ${next} in 0s`],
    ...players.map(([id], slot) => [
      ...phoneCommon,
      `${slot + 1} Your total · ${state.scores[id] ?? 0} points`,
      `+${state.lastPoints[id] ?? 0} this round · ${state.scores[id] ?? 0} points ${next} in 0s`,
    ]),
  ];
  const tvScreen = [
    `Round ${state.round} over`,
    'Players Round Total',
    ...tvRows,
    'Mass at the buzzer becomes points.',
    state.round >= 3 ? 'Final results follow shortly.' : 'Next round starts shortly.',
  ];
  const words = Math.max(
    wordCount(tvScreen.join(' ')),
    ...phoneScreens.map((screen) => wordCount(screen.join(' '))),
  );
  return Math.max(SCORE_MS, readingMs(words, { ui: true }));
}

export function enterScore(state: State, now: number): State {
  if (state.phase.id === 'score' || state.phase.id === 'done') return state;
  const lastPoints = roundPoints(state.world, Object.keys(state.players));
  const scores = Object.fromEntries(
    Object.entries(state.scores).map(([id, n]) => [id, n + (lastPoints[id] ?? 0)]),
  );
  const scored = { ...state, world: release(state.world), scores, lastPoints };
  return enterPhase(scored, 'score', now, scoreHold(scored));
}
export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
