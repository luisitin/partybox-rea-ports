// Honest board-only strategies: random legal, space/corner heuristic, and two-ply planning.
import { hasPlayer } from '@partybox/game-sdk';
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { slide } from './board';
import { DIRECTIONS } from './types';
import type { Input, State } from './types';

function quality(board: number[]): number {
  let empty = 0;
  let rough = 0;
  let order = 0;
  const logs = board.map((v) => (v ? Math.log2(v) : 0));
  for (let row = 0; row < 4; row++) {
    let rising = 0,
      falling = 0;
    for (let col = 0; col < 4; col++) {
      const i = row * 4 + col;
      const value = logs[i] ?? 0;
      if (board[i] === 0) empty++;
      if (col < 3) {
        const delta = value - (logs[i + 1] ?? 0);
        rising += Math.max(0, delta);
        falling += Math.max(0, -delta);
        if (value && logs[i + 1]) rough += Math.abs(delta);
      }
      if (row < 3 && value && logs[i + 4]) rough += Math.abs(value - (logs[i + 4] ?? 0));
    }
    order += Math.min(rising, falling);
  }
  for (let col = 0; col < 4; col++) {
    let rising = 0,
      falling = 0;
    for (let row = 0; row < 3; row++) {
      const delta = (logs[row * 4 + col] ?? 0) - (logs[(row + 1) * 4 + col] ?? 0);
      rising += Math.max(0, delta);
      falling += Math.max(0, -delta);
    }
    order += Math.min(rising, falling);
  }
  const biggest = Math.max(...board);
  const corner = [0, 3, 12, 15].some((i) => board[i] === biggest);
  return empty * 24 - rough * 2 - order * 8 + (corner ? Math.log2(biggest || 1) * 12 : 0);
}

export function botInput(
  state: State,
  playerId: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (state.phase.id !== 'play' || state.phase.paused || !hasPlayer(state, playerId)) return null;
  const me = state.racers[playerId];
  if (!me || !state.players[playerId]?.connected || me.status !== 'racing') return null;
  const choices = DIRECTIONS.map((dir) => ({ dir, moved: slide(me.board, dir) })).filter(
    (x) => x.moved.changed,
  );
  if (choices.length === 0) return null;
  let chosen = choices[rng.int(0, choices.length - 1)]!;
  if (skill !== 'easy') {
    let best = -Infinity;
    for (const choice of choices) {
      let value = quality(choice.moved.board) + Math.log2(choice.moved.gain + 1);
      if (skill === 'sharp') {
        const futures = DIRECTIONS.map((dir) => slide(choice.moved.board, dir)).filter(
          (x) => x.changed,
        );
        value += futures.length ? Math.max(...futures.map((x) => quality(x.board))) * 0.65 : -1000;
      }
      // Random tie order varies seats without reading future tile draws.
      if (value > best || (value === best && rng.float() < 0.5)) {
        best = value;
        chosen = choice;
      }
    }
  }
  return { type: 'move', dir: chosen.dir, move: me.moves };
}
