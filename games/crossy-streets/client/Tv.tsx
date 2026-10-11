// The public map is the focal point; the rail preserves every racer when the camera moves on.
import type { JSX } from 'react';
import { Stage, useSecondsLeft, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { CrossyTvView } from '../server/index';
import { Board, playerStyle } from './Board';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<CrossyTvView>): JSX.Element {
  const L = useT(STRINGS);
  const seconds = useSecondsLeft(view.deadline, view.paused, 250, view.clockHeldAt);
  const playing = view.phaseId === 'play';
  const order = [...view.runners].sort((a, b) => b.maxRow - a.maxRow || a.slot - b.slot);
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const best = order[0]?.maxRow ?? 0;
  const winners = order.filter((r) => r.maxRow === best);
  const headline = playing
    ? L('Crossy Streets')
    : winners.length === 1
      ? L('{name} went furthest!', { name: names.get(winners[0]!.id) ?? '' })
      : L('A tie at the top!');
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div>
          <h1>{headline}</h1>
          <p>
            {playing
              ? L('Hop ahead. Watch traffic. Ride the logs.')
              : L('Furthest row reached · highest wins')}
          </p>
        </div>
        {playing ? (
          <div className={styles.clock} role="timer" aria-label={L('Seconds left')}>
            <b>{seconds ?? view.seconds}</b>
            <span>{L('seconds')}</span>
          </div>
        ) : null}
      </header>
      <div className={styles.body}>
        <div className={styles.map}>
          <Board map={view.map} runners={view.runners} />
        </div>
        <aside className={styles.rail}>
          <h2>{playing ? L('Distance race') : L('Final distances')}</h2>
          <ol className={styles.standings}>
            {order.map((runner) => (
              <li
                key={runner.id}
                style={playerStyle(runner.slot)}
                data-leader={runner.maxRow === best || undefined}
              >
                <b className={styles.badge}>{runner.slot + 1}</b>
                <div className={styles.identity}>
                  <b>{names.get(runner.id)}</b>
                  <span>{runner.alive ? `${L('Row')} ${runner.row}` : L('Returning…')}</span>
                </div>
                <strong>{runner.maxRow}</strong>
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            {playing
              ? L(
                  'No progress for 8 seconds? The eagle comes. A crash sends you back; your best stays.',
                )
              : L('Every racer keeps their furthest row. Equal distances share the win.')}
          </p>
        </aside>
      </div>
    </Stage>
  );
}
