import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { ControllerMergeView } from '../server/types';
import { ranked } from './presentation';
import { STRINGS } from './strings';
import styles from './StandingsStrip.module.css';

/** Compact live standings leave the primary phone-only board and controls in one viewport. */
export function StandingsStrip({ view }: { view: ControllerMergeView }): JSX.Element {
  const L = useT(STRINGS);
  const names = Object.fromEntries(view.players.map((p) => [p.id, p.name]));
  const away = new Set(view.players.filter((p) => !p.connected).map((p) => p.id));
  return (
    <ol className={styles.rows} aria-label={L('Race standings')}>
      {ranked(view.racers).map((racer) => (
        <li key={racer.id} data-me={racer.id === view.me.id || undefined}>
          <span className={styles.rank}>#{racer.rank}</span>
          <span className={styles.name}>{names[racer.id] ?? racer.id}</span>
          {racer.bot || away.has(racer.id) ? (
            <span className={styles.status}>{racer.bot ? L('Bot') : L('Away')}</span>
          ) : null}
          <b>{racer.score}</b>
        </li>
      ))}
    </ol>
  );
}
