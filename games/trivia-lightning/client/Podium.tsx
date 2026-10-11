// Tied scores share a competition rank; unrevealed names never enter the rendered DOM.
import type { CSSProperties, JSX } from 'react';
import { Avatar, useT } from '@partybox/game-sdk/ui';
import type { TriviaTvView } from '../server/index';
import { STRINGS } from './strings';
import styles from './Podium.module.css';

export interface PodiumProps {
  lanes: TriviaTvView['lanes'];
  step: number;
  compact?: boolean;
}

export function Podium({ lanes, step, compact }: PodiumProps): JSX.Element {
  const L = useT(STRINGS);
  const groups = [1, 2, 3].map((rank) => ({
    rank,
    racers: lanes.filter((lane) => 1 + lanes.filter((r) => r.score > lane.score).length === rank),
  }));
  const columns: CSSProperties = {
    ['--pb-podium-columns' as string]: [groups[1], groups[0], groups[2]]
      .map((group) => `${Math.max(1, group?.racers.length ?? 0)}fr`)
      .join(' '),
  };
  return (
    <div
      className={styles.podium}
      style={columns}
      data-compact={compact || undefined}
      aria-label={L('Podium')}
    >
      {groups.map(({ rank, racers }) => {
        const visible = step >= 4 - rank;
        if (visible && racers.length === 0) return null;
        return (
          <section
            className={styles.place}
            data-rank={rank}
            data-shown={visible || undefined}
            data-many={racers.length > 3 || undefined}
            key={rank}
            aria-label={L('Place {rank}', { rank })}
          >
            <span className={styles.medal} aria-hidden="true">
              {rank}
            </span>
            {visible ? (
              <>
                <ul className={styles.names}>
                  {racers.map((racer) => (
                    <li key={racer.id}>
                      {!compact ? (
                        <Avatar avatarId={racer.avatarId} className={styles.avatar} />
                      ) : null}
                      <b>{racer.name}</b>
                    </li>
                  ))}
                </ul>
                <div className={styles.points}>
                  <strong>{racers[0]?.score ?? 0}</strong> {L('pts')}
                  {racers.length > 1 ? <span>{L('Tied')}</span> : null}
                </div>
              </>
            ) : (
              <div className={styles.unrevealed}>
                <strong>{L('Coming up…')}</strong>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
