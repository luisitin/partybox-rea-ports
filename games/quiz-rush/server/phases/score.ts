// Hold the settled leaderboard long enough to read every visible row and personal summary.
import { enterPhase, isTimerFor, readingMs, wordCount } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { standings } from '../scoring';
import { SCORE_MS } from '../types';
import type { Input, State, Transition } from '../types';

// Eight down-staggered rows: 7 * 75 ms + 300 ms entrance + 600 ms score count-up.
const SCORE_SETTLE_MS = 1425;

export function enterScore(state: State, now: number): State {
  const rows = standings(state);
  const perColumn = Math.ceil(rows.length / 2);
  const boundary = rows[perColumn];
  const mixedCrossColumnTie =
    boundary?.rank === rows[perColumn - 1]?.rank && rows.at(-1)?.rank !== boundary?.rank;
  const bands = rows.length >= 7 && !mixedCrossColumnTie ? '1–4 5–8' : '';
  const tv = [
    `Question ${state.round} of ${state.deck.length} Scoreboard`,
    bands,
    ...rows.map((p) => `${p.rank} ${p.name} ${p.gained ? `+${p.gained} ` : ''}${p.score}`),
  ].join(' ');
  const phoneRows = rows.map((p) => `${p.rank} ${p.name} ${p.score}`).join(' ');
  const phoneWords = rows.map((p) =>
    wordCount(
      `Scoreboard Place ${p.rank} ${p.score} points ` +
        ((state.streaks[p.id] ?? 0) > 0 ? `${state.streaks[p.id]} correct in a row ` : '') +
        phoneRows,
    ),
  );
  const words = Math.max(wordCount(tv), ...phoneWords);
  const ms = Math.max(SCORE_MS, SCORE_SETTLE_MS + readingMs(words, { ui: true }));
  return enterPhase(state, 'score', now, ms);
}
export function reduceScore(state: State, event: GameEvent<Input>, next: Transition): State {
  return isTimerFor(state, event) &&
    state.phase.deadline !== null &&
    event.now >= state.phase.deadline
    ? next(state, event.now)
    : state;
}
