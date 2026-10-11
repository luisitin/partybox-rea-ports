import type { JSX } from 'react';
import { useT } from '../ui/lang';
import { useBeats } from '../ui/motion';
import type { ScoreboardRow } from './row';
import styles from './Scoreboard.module.css';
import { STRINGS } from './strings';

/** One rank cell: the old rank until its own row lands, then the new one (a pop on the swap). */
export function RankCell({
  row,
  oldRank,
  landAtMs,
  climb,
  tied,
  held,
  trophy,
}: {
  row: ScoreboardRow;
  oldRank: number | null;
  landAtMs: number;
  climb: boolean;
  tied: boolean;
  held: boolean;
  trophy: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  const landed = useBeats([0, landAtMs]) === 1 || !climb;
  return (
    <span
      // the new rank pops in as its row lands (the swap class starts its animation)
      className={`${styles.rank} ${climb && landed ? styles.swap : ''}`}
      aria-label={
        // T-0181: the chip says "tied" to the eye; the label says it to a screen reader
        landed && tied
          ? L('rank {rank}, tied', { rank: row.rank })
          : landed || oldRank != null
            ? L('rank {rank}', { rank: landed ? row.rank : (oldRank ?? row.rank) })
            : undefined
      }
    >
      {held ? '·' : !landed ? (oldRank ?? '·') : row.rank === 1 && trophy ? '🏆' : row.rank}
    </span>
  );
}
