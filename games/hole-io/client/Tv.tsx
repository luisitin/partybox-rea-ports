// Each live player has a close native-style city camera on the shared television.
import type { JSX } from 'react';
import { Stage, useSecondsLeft, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { HoleTvView } from '../server/types';
import { City } from './City';
import { clockText, liveStandings, playerStyle, standings } from './presentation';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<HoleTvView>): JSX.Element {
  const L = useT(STRINGS);
  const seconds = useSecondsLeft(view.deadline, view.paused, 250, view.clockHeldAt) ?? 0;
  const rows = standings(view.city, view.players);
  const live = liveStandings(rows);
  const playing = view.phaseId === 'play';
  const winners = rows.filter((row) => row.rank === 1);
  return (
    <Stage className={styles.stage}>
      <div className={styles.page} data-phase={view.phaseId}>
        <header className={styles.header}>
          <div>
            <h2>{playing ? 'Hole.io' : L(winners.length > 1 ? 'Tied winners' : 'Winner')}</h2>
            <p>
              {L(playing ? 'Swallow the city. Watch out for bigger holes.' : 'Final standings')}
            </p>
          </div>
          {playing ? (
            <div className={styles.clock} data-low={seconds <= 5 || undefined}>
              <span>{L(view.paused ? 'Paused' : 'Time left')}</span>
              <strong role="timer" aria-label={L('{n} seconds left', { n: seconds })}>
                {clockText(seconds)}
              </strong>
            </div>
          ) : null}
        </header>
        {playing ? (
          live.length > 0 ? (
            <div className={styles.cameras} data-count={live.length} data-close-cameras="true">
              {live.map((row) => (
                <section
                  className={styles.camera}
                  key={row.hole.id}
                  style={playerStyle(row.hole.slot)}
                  data-camera-id={row.hole.id}
                  aria-label={L('Close city view following {name}', { name: row.name })}
                >
                  <City
                    city={view.city}
                    mine={row.hole.id}
                    compact
                    players={view.players}
                    elapsed={view.elapsed}
                    label={L('Close city view following {name}', { name: row.name })}
                  />
                  <div className={styles.cameraHud}>
                    <h3>{row.name}</h3>
                    <div className={styles.cameraStats}>
                      <span>{L('{n} points', { n: row.hole.score })}</span>
                      <span>{L('Size {n}', { n: row.hole.level ?? 1 })}</span>
                    </div>
                    <meter
                      className={styles.growth}
                      min={0}
                      max={1}
                      value={row.hole.levelProgress ?? 0}
                      aria-label={L('Growth to the next size')}
                    />
                  </div>
                  {!row.connected ? (
                    <p className={styles.connection} role="status">
                      {L('Disconnected')}
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          ) : (
            <div className={styles.empty} role="status">
              <h3>{L('No holes left in the city')}</h3>
              <p>{L('Banked points are safe. Final scores at the end of the clock.')}</p>
            </div>
          )
        ) : (
          <ol className={styles.rows} aria-label={L('Final standings')}>
            {rows.map((row) => (
              <li
                key={row.hole.id}
                style={playerStyle(row.hole.slot)}
                data-player-id={row.hole.id}
                data-winner={row.rank === 1 || undefined}
                aria-label={L('{name}, place {rank}, {score} points', {
                  name: row.name,
                  rank: row.rank,
                  score: row.hole.score,
                })}
              >
                <b className={styles.rowName}>{row.name}</b>
                <span className={styles.rank}>{L('Place {n}', { n: row.rank })}</span>
                <strong>{row.hole.score}</strong>
                {row.rank === 1 ? <span className={styles.winner}>{L('Winner')}</span> : null}
              </li>
            ))}
          </ol>
        )}
        {!playing && rows.length === 0 ? (
          <p className={styles.empty}>{L('The city is waiting for players.')}</p>
        ) : null}
      </div>
    </Stage>
  );
}
