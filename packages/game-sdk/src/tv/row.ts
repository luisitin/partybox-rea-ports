// A Scoreboard row (its own module so climb.ts and RankCell.tsx need not import the component).

export interface ScoreboardRow {
  playerId: string;
  name: string;
  avatarId: string;
  score: number;
  rank: number;
  /** Points gained since the last display (shown as +n; a loss as −n). */
  delta?: number;
  connected?: boolean;
  /** T-0257: short labels under the name (a hidden role, a power used), already translated. */
  tags?: string[];
}
