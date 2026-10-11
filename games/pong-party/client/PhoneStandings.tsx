import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { StandingRow } from './standings';
import { slotStyle } from './standings';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function PhoneStandings({
  rows,
  winnerIds,
}: {
  rows: StandingRow[];
  winnerIds: string[];
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <ul className={styles.rows} aria-label={L('Players, lives and saves')}>
      {rows.map((row) => (
        <li
          key={row.id}
          style={slotStyle(row.slot)}
          data-me={row.me ? 'true' : undefined}
          data-out={row.out ? 'true' : undefined}
        >
          <span className={styles.rowSlot}>{row.slot + 1}</span>
          <div className={styles.rowInfo}>
            <b className={styles.rowName}>{row.name}</b>
            <span className={styles.rowStats}>
              {row.out
                ? L('Out')
                : row.lives === 1
                  ? L('1 life')
                  : L('{n} lives', { n: row.lives })}{' '}
              · {row.saves === 1 ? L('1 save') : L('{n} saves', { n: row.saves })}
            </span>
          </div>
          {winnerIds.includes(row.id) ? (
            <span className={styles.winner} aria-label={L('Winner')}>
              ★
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
