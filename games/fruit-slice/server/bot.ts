// Search safe strokes using only the same current targets the bot's phone receives.
import type { BotSkill, Rng } from '@partybox/game-sdk';
import { hasPlayer } from '@partybox/game-sdk';
import type { Input, Point, State } from './types';
import { crosses, targetsAt } from './world';

export function botInput(
  state: State,
  id: string,
  rng: Rng,
  skill: BotSkill = 'normal',
): Input | null {
  if (
    state.phase.id !== 'play' ||
    state.phase.paused ||
    !hasPlayer(state, id) ||
    !state.players[id]?.connected
  )
    return null;
  const seat = state.seats[id]!;
  if (
    seat.bombed ||
    seat.strokes >= 20 ||
    rng.float() < (skill === 'easy' ? 0.4 : skill === 'sharp' ? 0.02 : 0.15)
  )
    return null;
  const targets = targetsAt(state.fruit, state.checked, state.wave).filter(
    (f) => !seat.cut.includes(f.id),
  );
  const fruits = targets.filter((f) => !f.bomb);
  if (fruits.length === 0) return null;
  let best: Point[] = [];
  let hits = 0;
  for (const a of fruits)
    for (const b of fruits) {
      const points = [
        { x: Math.max(0, a.x - 7), y: a.y },
        { x: Math.min(100, b.x + 7), y: b.y },
      ];
      if (skill !== 'easy' && targets.some((f) => f.bomb && crosses(points, f))) continue;
      const count = fruits.filter((f) => crosses(points, f)).length;
      if (count > hits) {
        best = points;
        hits = count;
      }
    }
  if (hits === 0) return null;
  if (skill === 'easy')
    best = [
      { x: Math.max(0, fruits[0]!.x - 7), y: fruits[0]!.y },
      { x: Math.min(100, fruits[0]!.x + 7), y: fruits[0]!.y },
    ];
  return {
    type: 'slice',
    wave: state.wave,
    frame: state.checked,
    seq: seat.lastSeq + 1,
    points: best,
  };
}
