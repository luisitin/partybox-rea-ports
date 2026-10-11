// All towers share one focal play field; names and depth remain readable from the sofa.
import type { JSX } from 'react';
import { Stage, useServerNow } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { HelixTvView } from '../server/index';
import { Tower, slotStyle } from './Tower';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<HelixTvView>): JSX.Element {
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const left = Math.max(0, Math.ceil(((view.deadline ?? now) - now) / 1000));
  const play = view.phaseId === 'play';
  const winner =
    view.winnerIds.length === 1 ? view.players.find((p) => p.id === view.winnerIds[0])?.name : null;
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div>
          <h1>{play ? 'Helix Drop' : winner ? `${winner} wins!` : 'Shared victory!'}</h1>
          <p>
            {play
              ? 'Line up the gaps · × danger · 3 gaps charge a smash'
              : 'Deepest completed floor wins'}
          </p>
        </div>
        {play ? (
          <span className={styles.timer} role="timer" aria-label={`${left} seconds remaining`}>
            {left}
            <small>s</small>
          </span>
        ) : null}
      </header>
      <div className={styles.lanes} data-count={view.lanes.length}>
        {view.lanes.map((lane) => (
          <section
            key={lane.id}
            className={styles.lane}
            style={slotStyle(lane.slot)}
            data-out={lane.lives === 0 || undefined}
            aria-label={`${view.players.find((p) => p.id === lane.id)?.name}, ${lane.best} floors`}
          >
            <div className={styles.label}>
              <b>
                {lane.slot + 1}. {view.players.find((p) => p.id === lane.id)?.name}
              </b>
              <strong>
                {lane.best}
                <small> floors</small>
              </strong>
            </div>
            <div className={styles.tower}>
              <Tower lane={lane} />
            </div>
            <p>
              {lane.cleared
                ? '✓ Tower cleared'
                : lane.lives === 0
                  ? '× Run complete'
                  : lane.recovering
                    ? '↻ Fresh attempt'
                    : lane.chain >= 3
                      ? '⚡ SMASH charged'
                      : `${lane.lives} lives · floor ${lane.floor + 1}`}
            </p>
          </section>
        ))}
      </div>
    </Stage>
  );
}
