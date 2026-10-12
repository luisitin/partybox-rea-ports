import type { JSX } from 'react';
import { Stage, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { TvMergeView } from '../server/types';
import { Board } from './Board';
import { clockText, playerColor, ranked } from './presentation';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<TvMergeView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const playing = view.phaseId === 'play';
  const left = view.deadline === null ? null : Math.max(0, view.deadline - now);
  const names = Object.fromEntries(view.players.map((p) => [p.id, p.name]));
  const away = new Set(view.players.filter((p) => !p.connected).map((p) => p.id));
  const rows = playing ? view.racers : ranked(view.racers);
  const winner = view.winners[0];
  const headline = playing
    ? L('2048')
    : view.winners.length > 1
      ? L('A tie at the top!')
      : L('{name} wins!', { name: names[winner ?? ''] ?? L('The race') });
  const subtitle = playing
    ? L('First to {target} wins. At the buzzer, highest score wins.', { target: view.target })
    : view.reason === 'target'
      ? L('{target} reached — race complete!', { target: view.target })
      : view.reason === 'clock'
        ? L('Time is up — highest score wins.')
        : view.reason === 'blocked'
          ? L('No moves remain — highest score wins.')
          : L('Race complete — final standings.');

  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1>{headline}</h1>
          <p>{subtitle}</p>
        </div>
        {playing && left !== null ? (
          <div className={styles.clock} role="timer" data-urgent={left <= 5000 || undefined}>
            <span>{view.paused ? L('Paused') : L('Time left')}</span>
            <strong>{clockText(left)}</strong>
          </div>
        ) : (
          <div className={styles.finish}>
            <span aria-hidden="true">✓</span>
            <b>{L('Final standings')}</b>
          </div>
        )}
      </header>
      <div className={styles.racers} data-count={rows.length}>
        {rows.map((racer) => {
          const slot = view.racers.findIndex((r) => r.id === racer.id);
          return (
            <article
              className={styles.racer}
              key={racer.id}
              style={playerColor(slot)}
              data-winner={view.winners.includes(racer.id) || undefined}
            >
              <header className={styles.racerHeader}>
                <b className={styles.rank}>#{racer.rank}</b>
                <h2 title={names[racer.id] ?? racer.id}>{names[racer.id] ?? racer.id}</h2>
                {view.winners.includes(racer.id) ? (
                  <span aria-label={L('Winner')}>{racer.bot ? `${L('Bot')} ★` : '★'}</span>
                ) : racer.status === 'blocked' ? (
                  <span className={styles.status}>
                    {racer.bot ? `${L('Bot')} · ` : ''}
                    {L('No moves')}
                  </span>
                ) : (
                  <span className={styles.status}>
                    {racer.bot
                      ? L('Bot')
                      : away.has(racer.id) && playing
                        ? L('Away')
                        : playing
                          ? L('Racing')
                          : L('Locked')}
                  </span>
                )}
              </header>
              <div className={styles.summary}>
                <div className={styles.best}>
                  <span>{L('Best')}</span>
                  <strong>{racer.best}</strong>
                </div>
                <div className={styles.score}>
                  <span>{L('Score')}</span>
                  <strong>{racer.score}</strong>
                </div>
              </div>
              <Board
                board={racer.board}
                label={L('{name}’s board', { name: names[racer.id] ?? racer.id })}
                tvMap
              />
            </article>
          );
        })}
      </div>
    </Stage>
  );
}
