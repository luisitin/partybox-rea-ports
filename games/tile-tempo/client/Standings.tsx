// Compact phone standings include every seat, including players who crashed or disconnected.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { TileTempoControllerView } from '../server/index';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Standings({
  rows,
  me,
  phase,
}: {
  rows: TileTempoControllerView['standings'];
  me: string;
  phase: string;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <section className={styles.standings} aria-label={L('Standings')}>
      <h3 className={styles.standingsTitle}>{L('Standings · tiles')}</h3>
      <ol className={styles.rows}>
        {[...rows]
          .sort((a, b) => a.rank - b.rank)
          .map((p) => (
            <li key={p.id} data-me={p.id === me ? 'true' : undefined}>
              <span className={styles.rank}>{p.rank}</span>
              <span className={styles.player}>
                <b className={styles.name} title={p.name}>
                  {p.name}
                </b>
                <span className={styles.status}>
                  {phase === 'score' || phase === 'done'
                    ? L('Finished')
                    : !p.connected
                      ? L('Disconnected')
                      : p.out
                        ? L('Out')
                        : phase === 'ready'
                          ? L('Ready')
                          : L('Playing')}
                </span>
              </span>
              <b className={styles.rowCount}>{p.tiles}</b>
            </li>
          ))}
      </ol>
    </section>
  );
}
