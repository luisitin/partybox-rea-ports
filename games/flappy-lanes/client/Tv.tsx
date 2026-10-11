import type { JSX } from 'react';
import { Stage, usePrefersReducedMotion, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { FlappyTvView } from '../server/index';
import { Arena } from './Arena';
import { standingsRows } from './standings';
import { STRINGS } from './strings';
import { clockText, laneStyle, visualTime } from './timing';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<FlappyTvView>): JSX.Element {
  const L = useT(STRINGS);
  const reduced = usePrefersReducedMotion();
  const now = useServerNow(33, view.paused, view.clockHeldAt);
  const playing = view.phaseId === 'play';
  const time = visualTime(view.began, view.checked, now, !playing || view.paused || reduced);
  const left = Math.max(0, view.endsAt - now);
  const rows = standingsRows(view);
  const top = Math.max(0, ...rows.map((row) => row.total));
  const leaders = rows.filter((row) => row.total === top);
  const title = playing
    ? L('Round {n} of {m}', { n: view.round, m: view.rounds })
    : view.phaseId === 'score'
      ? L('Round {n} complete', { n: view.round })
      : leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the top!');
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>
            {playing
              ? L('{n} of {m} still flying', { n: view.aliveCount, m: rows.length })
              : L('Longest flight wins · same course for every lane')}
          </p>
        </div>
        {playing ? (
          <div className={styles.clock} role="timer" data-low={left <= 5000 ? 'true' : undefined}>
            <span>{L('Time left')}</span>
            <strong>{clockText(left)}</strong>
          </div>
        ) : null}
      </header>
      <div className={styles.lanes} data-small={view.birds.length <= 4 ? 'true' : undefined}>
        {view.birds.map((bird, slot) => {
          const row = rows[slot];
          if (!row) return null;
          return (
            <section
              key={bird.id}
              className={styles.lane}
              style={laneStyle(slot)}
              data-out={bird.died !== null ? 'true' : undefined}
            >
              <div className={styles.label}>
                <b className={styles.number}>{slot + 1}</b>
                <h2 className={styles.name}>{row.name}</h2>
                <span className={styles.state}>{bird.died !== null ? L('OUT') : L('FLYING')}</span>
              </div>
              <div className={styles.flight}>
                <Arena
                  bird={bird}
                  gates={view.gates}
                  time={time}
                  reduced={reduced}
                  label={L('Lane {n}: {name}', { n: slot + 1, name: row.name })}
                />
              </div>
              <div className={styles.stats}>
                <span>{L('{n} gates', { n: bird.passed })}</span>
                <strong>
                  {playing
                    ? L('{n} points', { n: row.total })
                    : L('+{n} · {m} total', { n: row.gained, m: row.total })}
                </strong>
              </div>
            </section>
          );
        })}
      </div>
    </Stage>
  );
}
