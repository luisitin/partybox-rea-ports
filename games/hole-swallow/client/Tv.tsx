// The city is the focal point; the rail keeps identities, scores and the 90-second clock readable.
import type { JSX } from 'react';
import { Stage, useSecondsLeft, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { HoleTvView } from '../server/types';
import { City, PropArt } from './City';
import {
  clockText,
  playerStyle,
  PROP_ART_EXTENT,
  standings,
  TARGETS,
  winnerLine,
} from './presentation';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<HoleTvView>): JSX.Element {
  const L = useT(STRINGS);
  const seconds = useSecondsLeft(view.deadline, view.paused, 250, view.clockHeldAt) ?? 0;
  const rows = standings(view.city, view.players);
  const playing = view.phaseId === 'play';
  return (
    <Stage className={styles.stage}>
      <div className={styles.layout}>
        <section className={styles.citySide} aria-label={L('City')}>
          <div className={styles.heading}>
            <h2>
              {playing
                ? L('Small bites. Big city.')
                : view.phaseId === 'reveal'
                  ? L('City closed!')
                  : L(winnerLine(rows))}
            </h2>
            <p>
              {playing
                ? L('Eat what fits. Grow. Swallow smaller rivals.')
                : L('Most points wins · Your score survives a swallow')}
            </p>
          </div>
          <div className={styles.map}>
            <City city={view.city} />
          </div>
          <ol className={styles.progression} aria-label={L('Grow to swallow larger objects')}>
            {TARGETS.map((t) => (
              <li key={t.kind}>
                <svg
                  viewBox={`${-PROP_ART_EXTENT[t.kind]} ${-PROP_ART_EXTENT[t.kind]} ${PROP_ART_EXTENT[t.kind] * 2} ${PROP_ART_EXTENT[t.kind] * 2}`}
                  aria-hidden="true"
                >
                  <PropArt kind={t.kind} />
                </svg>
                <span>{L(t.label)}</span>
              </li>
            ))}
          </ol>
        </section>
        <aside className={styles.rail}>
          {playing ? (
            <div className={styles.clock} data-low={seconds <= 5 || undefined}>
              <span>{view.paused ? L('Paused') : L('Time left')}</span>
              <strong role="timer" aria-label={L('{n} seconds left', { n: seconds })}>
                {clockText(seconds)}
              </strong>
            </div>
          ) : (
            <p className={styles.resultsLabel}>
              {view.phaseId === 'reveal' ? L('Final standings') : L('The city champions')}
            </p>
          )}
          <ol className={styles.rows} aria-label={L('Player scores')}>
            {rows.map((r) => (
              <li
                key={r.hole.id}
                style={playerStyle(r.hole.slot)}
                data-leader={(!playing && r.rank === 1) || undefined}
              >
                <span
                  className={styles.identity}
                  aria-label={L('Hole {n}', { n: r.hole.slot + 1 })}
                >
                  {r.hole.slot + 1}
                </span>
                <div className={styles.player}>
                  <b title={r.name}>{r.name}</b>
                  <span>
                    {!playing
                      ? L('Place {n}', { n: r.rank })
                      : !r.connected
                        ? L('Disconnected')
                        : r.hole.respawnIn > 0
                          ? L('Back in {n}s', { n: Math.ceil(r.hole.respawnIn / 1000) })
                          : r.hole.shield
                            ? L('Protected')
                            : L('Swallowing')}
                  </span>
                </div>
                <strong className={styles.score}>{r.hole.score}</strong>
              </li>
            ))}
          </ol>
          {rows.length === 0 ? (
            <p className={styles.empty}>{L('The city is waiting for players.')}</p>
          ) : null}
        </aside>
      </div>
    </Stage>
  );
}
