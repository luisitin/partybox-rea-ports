import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { MatchView } from '../server/index';
import { slotStyle, standingsRows } from './display';
import styles from './Standings.module.css';
import { STRINGS } from './strings';

export function Standings({
  view,
  meId,
  compact = false,
}: {
  view: MatchView & { players: { id: string; name: string }[] };
  meId?: string;
  compact?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <ol
      className={styles.rows}
      data-compact={compact ? 'true' : undefined}
      aria-label={L('Match standings')}
    >
      {standingsRows(view).map((row) => (
        <li key={row.id} style={slotStyle(row.slot)} data-me={row.id === meId ? 'true' : undefined}>
          <b
            className={styles.rank}
            aria-label={
              row.tied ? L('Rank {n}, tied', { n: row.rank }) : L('Rank {n}', { n: row.rank })
            }
          >
            {row.rank}
            {row.tied ? '=' : ''}
          </b>
          <span className={styles.name}>{row.name}</span>
          {!compact ? <span className={styles.gain}>{L('+{n} m', { n: row.gained })}</span> : null}
          <b className={styles.total}>{L('{n} m', { n: row.total })}</b>
        </li>
      ))}
    </ol>
  );
}
