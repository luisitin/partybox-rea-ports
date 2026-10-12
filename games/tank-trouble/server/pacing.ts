// Count the fullest visible interlude, including its numbered maze or private rank receipt.
import { readingMs, wordCount } from '@partybox/game-sdk';
import type { State } from './types';

export function readyDuration(state: State): number {
  const numbers = state.world.tanks.map((tank) => tank.slot + 1).join(' ');
  const heading = `Round ${state.round}`;
  // Countdown numbers stay one visible word as they change.
  const surfaces = [
    `${heading} ${numbers} Find your tank 1`,
    `${heading} Spectating ${numbers} Get ready 1`,
  ];
  for (const tank of state.world.tanks) {
    const slot = tank.slot + 1;
    surfaces.push(
      `${heading} ${slot} Your tank ${slot} Ready 1`,
      `${heading} Tank ${slot} ${numbers} Get ready 1`,
    );
  }
  return readingMs(Math.max(...surfaces.map(wordCount)), { ui: true });
}
export function scoreDuration(state: State): number {
  const winnerId = state.winnerIds[0];
  const winner = winnerId === undefined ? undefined : state.players[winnerId];
  const won = state.reason === 'last-standing' && winner;
  const outcome = won
    ? `${winner.name} wins +1 ${state.scores[winner.id] ?? 0} total wins`
    : `${state.reason === 'time' ? 'Time up' : state.reason === 'skip' ? 'Round skipped' : 'No survivors'} No round points`;
  const next = state.round >= 5 ? 'Results 1s' : 'Next 1s';
  const common = `Round ${state.round} ${outcome} ${next}`;
  const surfaces = [common];
  // Every original player keeps their result receipt, including departed seats.
  for (const player of Object.values(state.players)) {
    const total = state.scores[player.id] ?? 0;
    const rank = 1 + Object.values(state.scores).filter((score) => score > total).length;
    const gain = state.lastPoints[player.id] ?? 0;
    surfaces.push(`${common} Your rank #${rank} ${total} wins +${gain} this round`);
  }
  return readingMs(Math.max(...surfaces.map(wordCount)), { ui: true });
}
