// One full-height lane per climber: numbered identity, public height, and an explicit fallen state.
import type { JSX } from 'react';
import { Stage, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { ClimbTvView } from '../server/index';
import { Climb } from './Climb';
import { climbRows, clockText, playerStyle } from './display';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<ClimbTvView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const phase = view.phaseId;
  const rows = climbRows(view);
  const best = Math.max(0, ...rows.map((r) => r.total));
  const leaders = rows.filter((r) => r.total === best);
  const left = Math.max(0, (view.deadline ?? view.endsAt) - now);
  const title =
    phase === 'done'
      ? leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the top!')
      : phase === 'score'
        ? L('Round {n} over', { n: view.round })
        : phase === 'ready'
          ? L('Get ready to climb')
          : L('Highest climb wins');
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.intro}>
          <p className={styles.round}>{L('Round {n} of {m}', { n: view.round, m: view.rounds })}</p>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.hint}>
            {phase === 'play'
              ? L('Bounce automatically. Hold left or right to land.')
              : phase === 'ready'
                ? L('Same course. A fresh start for everyone.')
                : L('Height this round adds to your total.')}
          </p>
        </div>
        {phase === 'play' || phase === 'ready' ? (
          <div className={styles.clock} role="timer" data-low={left <= 5000 ? 'true' : undefined}>
            <span className={styles.clockLabel}>
              {phase === 'ready' ? L('Starts in') : L('Time left')}
            </span>
            <b>{phase === 'ready' ? Math.max(1, Math.ceil(left / 1000)) : clockText(left)}</b>
          </div>
        ) : null}
      </header>
      <div
        className={styles.lanes}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, rows.length)}, minmax(0, 1fr))` }}
      >
        {rows.map((row) => {
          const climber = view.climbers[row.slot];
          if (!climber) return null;
          return (
            <section key={row.id} className={styles.lane} style={playerStyle(row.slot)}>
              <div className={styles.identity}>
                <span className={styles.slot}>{row.slot + 1}</span>
                <b className={styles.name}>{row.name}</b>
              </div>
              <div className={styles.scene}>
                <Climb
                  climber={climber}
                  platforms={view.platforms}
                  slot={row.slot}
                  label={L('{name}: height {n}', { name: row.name, n: row.height })}
                />
                {row.out ? <p className={styles.out}>{L('Out')}</p> : null}
              </div>
              <div className={styles.height}>
                <b>{row.height}</b>
                <span>{L('height')}</span>
              </div>
              {phase === 'score' || phase === 'done' ? (
                <p className={styles.total}>{L('{n} total', { n: row.total })}</p>
              ) : (
                <p className={styles.total}>
                  {row.out ? L('Next round: try again') : L('Still climbing')}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </Stage>
  );
}
