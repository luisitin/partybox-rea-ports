import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { Row } from '../server/types';
import { STRINGS } from './strings';
import styles from './Standings.module.css';

export function Standings({
  rows,
  me,
  compact = false,
  final = false,
}: {
  rows: Row[];
  me?: string;
  compact?: boolean;
  final?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  return (
    <div className={styles.standings} data-compact={compact ? 'true' : undefined}>
      <div className={styles.head} aria-hidden="true">
        <span>{L('Players')}</span>
        <span>{L('Points')}</span>
        <span>{final ? L('Best combo') : L('Streak')}</span>
      </div>
      <ol className={styles.rows} aria-label={L('Players, points and streaks')}>
        {sorted.map((row) => (
          <li key={row.id} data-me={row.id === me ? 'true' : undefined}>
            <b className={styles.name}>
              {final ? `${1 + rows.filter((other) => other.score > row.score).length}. ` : ''}
              {row.name}
              {!final && row.gain > 0 ? (
                <span
                  className={styles.gain}
                  aria-label={L('Last swipe: +{n} points', { n: row.gain })}
                >
                  {' '}
                  +{row.gain}
                </span>
              ) : null}
            </b>
            <strong className={styles.points}>{row.score}</strong>
            <span
              className={styles.streak}
              aria-label={
                final
                  ? L('Best combo: {n} fruit', { n: row.bestCombo })
                  : L('Streak: {n} safe waves', { n: row.streak })
              }
            >
              <span aria-hidden="true">{final ? '◆ ' : row.bombed ? '× ' : '↗ '}</span>
              {final ? row.bestCombo : row.streak}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
