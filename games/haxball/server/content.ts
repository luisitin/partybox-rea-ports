// Owned pitch tuning and public formation; no copied source code or remote content.
import { H, W } from './types';
import type { Body, Disc, State, Team } from './types';

export const TEAM_NAMES: Record<Team, string> = { red: 'Red', blue: 'Blue' };
export const centerBall = (): Body => ({ x: W / 2, y: H / 2, vx: 0, vy: 0 });
export const attacksRight = (state: State, team: Team): boolean =>
  team === 'red' ? state.redAttacksRight : !state.redAttacksRight;

/** Every team gets the same formation, mirrored about the centre. */
export function formation(discs: Disc[], redAttacksRight: boolean): Disc[] {
  return discs.map((disc) => {
    const team = discs.filter((other) => other.team === disc.team);
    const right = disc.team === 'red' ? redAttacksRight : !redAttacksRight;
    const slot = Math.max(
      0,
      team.findIndex((other) => other.id === disc.id),
    );
    const x = slot === 0 ? W * 0.33 : slot === 1 ? W * 0.15 : W * 0.25;
    const y = team.length <= 2 ? H / 2 : slot < 2 ? H / 2 : slot === 2 ? H * 0.27 : H * 0.73;
    return { ...disc, x: right ? x : W - x, y, vx: 0, vy: 0 };
  });
}
