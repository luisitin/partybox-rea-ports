import { readingMs, wordCount } from '@partybox/game-sdk';
import { winners } from './scoring';
import { REVEAL_MS, TARGET } from './types';
import type { State } from './types';

/** The frozen TV boards and phone result list are separate screens: hold for the larger one. */
export function revealReadingMs(state: State): number {
  const winnerIds = winners(state);
  const winning = new Set(winnerIds);
  const headline =
    winnerIds.length > 1
      ? wordCount('A tie at the top!')
      : wordCount(`${state.players[winnerIds[0] ?? '']?.name ?? 'The race'} wins!`);
  const tvReason =
    state.reason === 'target'
      ? `${TARGET} reached — race complete!`
      : state.reason === 'clock'
        ? 'Time is up — highest score wins.'
        : state.reason === 'blocked'
          ? 'No moves remain — highest score wins.'
          : 'Race complete — final standings.';
  const phoneReason =
    state.reason === 'target'
      ? `${TARGET} reached!`
      : state.reason === 'clock'
        ? 'Time is up. Highest score wins.'
        : state.reason === 'blocked'
          ? 'No moves remain. Highest score wins.'
          : 'Final standings';
  let tv = headline + wordCount(tvReason) + wordCount('✓ Final standings');
  let phone = headline + wordCount(phoneReason);
  let personal = 0;
  for (const [id, racer] of Object.entries(state.racers)) {
    const name = wordCount(state.players[id]?.name ?? id);
    // Rank/name/status, best-tile and score labels/numbers, plus every occupied board cell.
    tv +=
      1 +
      name +
      wordCount(winning.has(id) ? '★' : racer.status === 'blocked' ? 'No moves' : 'Locked') +
      wordCount(`Best tile ${Math.max(...racer.board)} Score ${racer.score}`) +
      racer.board.filter((value) => value !== 0).length;
    phone += 1 + name + wordCount(`Best tile ${Math.max(...racer.board)} ${racer.score}`);
    // Phone final rows keep bot identity after the generic host strip is hidden.
    if (state.players[id]?.bot) phone++;
    if (state.players[id]?.bot && (winning.has(id) || racer.status === 'blocked')) tv++;
    if (winning.has(id)) phone++;
    personal = Math.max(
      personal,
      wordCount(
        winning.has(id)
          ? `You won! · ${racer.score} points`
          : `You finished #8 · ${racer.score} points`,
      ),
    );
  }
  const footer =
    state.reason === 'target'
      ? `First to ${TARGET} wins. Reaching the target beats merge score.`
      : 'Equal scores share a place.';
  phone += personal + wordCount(footer);
  // The TV module hides the generic player strip; both result layouts are English UI copy.
  return Math.max(REVEAL_MS, readingMs(Math.max(tv, phone), { ui: true }));
}
