// The same numbered roster on the TV, spectator stage and phone-only stage.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { StandingRow } from './standingsRows';
import { STRINGS } from './strings';
import { playerStyle } from './timing';
import styles from './Standings.module.css';

interface StandingsProps {
  rows: StandingRow[];
  phase: string;
  me?: string;
  compact?: boolean;
}

export function Standings({ rows, phase, me, compact }: StandingsProps): JSX.Element {
  const L = useT(STRINGS);
  return (
    <ol
      className={styles.rows}
      data-compact={compact || undefined}
      data-phase={phase}
      aria-label={phase === 'play' ? L('Snake sizes') : L('Match standings')}
    >
      {rows.map((row) => {
        const status = !row.connected
          ? L('Reconnecting')
          : row.respawnIn > 0
            ? L('Back in {n}s', { n: row.respawnIn })
            : row.protected
              ? L('Shielded')
              : row.boost
                ? L('Boosting')
                : L('Growing');
        return (
          <li
            key={row.id}
            style={playerStyle(row.slot)}
            data-me={row.id === me || undefined}
            data-respawn={row.respawnIn > 0 || undefined}
          >
            <span className={styles.number} aria-label={L('Snake {n}', { n: row.slot + 1 })}>
              {row.slot + 1}
            </span>
            <div className={styles.identity}>
              <b className={styles.name} title={row.name}>
                {row.name}
              </b>
              {phase === 'play' ? <span className={styles.status}>{status}</span> : null}
            </div>
            <div className={styles.value}>
              <b>{phase === 'play' ? row.mass : row.total}</b>
              {phase === 'score' ? (
                <span className={styles.gain}>{L('+{n}', { n: row.gained })}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
