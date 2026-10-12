// Count the fullest visible surface, including actual names and every standings cell.
import { readingMs, wordCount } from '@partybox/game-sdk';
import type { State } from './types';

function rows(state: State, ranked: boolean): string {
  return Object.values(state.players)
    .map((player, slot) => {
      const tank = state.world.tanks.find((t) => t.id === player.id);
      const total = state.scores[player.id] ?? 0;
      const rank = 1 + Object.values(state.scores).filter((score) => score > total).length;
      const gain = state.lastPoints[player.id] ?? 0;
      return `${slot + 1} ${player.name} ${ranked ? `#${rank}` : ''} ${total} ${
        gain > 0 ? `+${gain}` : ''
      } ${!tank ? 'Left' : player.connected === false ? 'Offline' : ''}`;
    })
    .join(' ');
}
export function readyDuration(state: State): number {
  const table = rows(state, false);
  const numbers = state.world.tanks.map((tank) => tank.slot + 1).join(' ');
  const tv = `Round ${state.round} of 5 Find your numbered tank. Follow its barrel to aim.
    ${numbers} 20 ✦ Burst ━ Beam ◈ Seeker Round wins ${table}`;
  const phone = `Round ${state.round} of 5 8 You are tank 8 Find your number on the TV.
    Forward, reverse, turn and fire. 20`;
  const stage = `Round ${state.round} of 5 You are tank 8 ${numbers}
    Find your numbered tank · 20s ${table} Forward, reverse, turn and fire. Shots can hit you.`;
  return readingMs(Math.max(wordCount(tv), wordCount(phone), wordCount(stage)), { ui: true });
}
export function scoreDuration(state: State): number {
  const outcome =
    state.reason === 'time'
      ? 'Time up — no round points'
      : state.reason === 'draw'
        ? 'No survivors — no round points'
        : state.reason === 'skip'
          ? 'Round skipped'
          : 'Last tank wins one point';
  const table = rows(state, true);
  const numbers = state.world.tanks.map((tank) => tank.slot + 1).join(' ');
  const next = state.round >= 5 ? 'Final standings in 20s' : 'Next maze in 20s';
  const tv = `Round ${state.round} complete ${outcome} ${numbers} ✦ Burst ━ Beam ◈ Seeker
    Round wins ${table} ${next}`;
  const phone = `Round ${state.round} complete ${outcome} ${numbers}
    +1 this round · 5 wins so far ${table} ${next}`;
  return readingMs(Math.max(wordCount(tv), wordCount(phone)), { ui: true });
}
