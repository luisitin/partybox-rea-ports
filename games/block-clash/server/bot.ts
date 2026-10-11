// Bots use reachable placement goals and the same individual button inputs as a human.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { hasPlayer } from '@partybox/game-sdk';
import { fits, rotate } from './pieces';
import { placement } from './strategy';
import type { Input, State } from './types';

export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = state.botSkill,
): Input | null {
  if (state.phase.id !== 'play' || state.phase.paused || !hasPlayer(state, id)) return null;
  const board = state.boards.find((b) => b.id === id);
  if (!board?.alive || !board.active || board.lastInputAt >= state.checked) return null;
  const active = board.active;
  const goal =
    (skill === state.botSkill ? board.plan : null) ??
    placement(board.grid, active, skill, `${id}:${board.sequence}`);
  if (active.rotation !== goal.rotation) {
    const direction = (goal.rotation - active.rotation + 4) % 4 === 3 ? 'ccw' : 'cw';
    if (rotate(board.grid, active, direction)) return { type: 'rotate', direction };
  }
  const direction = active.x < goal.x ? 'right' : 'left';
  if (
    active.x !== goal.x &&
    fits(board.grid, { ...active, x: active.x + (direction === 'right' ? 1 : -1) })
  )
    return { type: 'move', direction };
  // Targeting the most vulnerable living rival is a deliberate tactical choice.
  const rival = state.boards
    .filter((b) => b.id !== id && b.alive)
    .sort((a, b) => {
      const height = (grid: number[][]): number => {
        const top = grid.findIndex((row) => row.some((cell) => cell !== 0));
        return top < 0 ? 0 : 20 - top;
      };
      return height(b.grid) - height(a.grid);
    })[0];
  if (rival && rival.id !== board.target && rng.chance(skill === 'sharp' ? 0.35 : 0.1))
    return { type: 'target', playerId: rival.id };
  return { type: 'drop' };
}
