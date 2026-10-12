import { readingMs, wordCount } from '@partybox/game-sdk';
import { winners } from './scoring';
import { REVEAL_MS, TARGET } from './types';
import type { State } from './types';

/** TV summaries and phone standings are separate result screens: hold for the larger one. */
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
    const identity = state.players[id]?.bot
      ? 'Bot'
      : state.players[id]?.connected === false
        ? 'Away'
        : '';
    const status = winning.has(id)
      ? `${identity} ★`
      : racer.status === 'blocked'
        ? `${identity}${identity ? ' · ' : ''}No moves`
        : identity || 'Locked';
    // Final TV cards have no board maps: count their rank, name, status and summaries.
    tv +=
      1 +
      name +
      wordCount(status) +
      wordCount(`Best ${Math.max(...racer.board)} Score ${racer.score}`);
    phone += 1 + name + wordCount(`Best tile ${Math.max(...racer.board)} ${racer.score}`);
    // Phone final rows keep bot identity after the generic host strip is hidden.
    if (state.players[id]?.bot) phone++;
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
