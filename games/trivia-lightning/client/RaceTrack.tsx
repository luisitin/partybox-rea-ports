// An original lightning-token track. Every value comes from the public view, never an answer key.
import type { CSSProperties, JSX } from 'react';
import { Avatar, useT } from '@partybox/game-sdk/ui';
import type { TriviaTvView } from '../server/index';
import { STRINGS } from './strings';
import styles from './RaceTrack.module.css';

type Lane = TriviaTvView['lanes'][number];

export interface RaceTrackProps {
  lanes: Lane[];
  total: number;
  compact?: boolean;
  meId?: string;
  ranked?: boolean;
}

export function RaceTrack({ lanes, total, compact, meId, ranked }: RaceTrackProps): JSX.Element {
  const L = useT(STRINGS);
  return (
    <ol
      className={styles.lanes}
      data-compact={compact || undefined}
      aria-label={L('Race progress')}
    >
      {lanes.map((lane, slot) => {
        const progress = Math.min(1, Math.max(0, lane.answered / Math.max(1, total)));
        const rank = 1 + lanes.filter((other) => other.score > lane.score).length;
        const tied = lanes.filter((other) => other.score === lane.score).length > 1;
        const css: CSSProperties = {
          ['--pb-lane-color' as string]: `var(--pb-player-${(slot % 8) + 1})`,
          ['--pb-runner-progress' as string]: progress,
        };
        return (
          <li
            key={lane.id}
            className={styles.lane}
            style={css}
            data-me={lane.id === meId || undefined}
            data-frozen={lane.frozen || undefined}
          >
            <div className={styles.identity}>
              <Avatar avatarId={lane.avatarId} className={styles.avatar} />
              <div className={styles.nameBlock}>
                <b className={styles.name} title={lane.name}>
                  {lane.name}
                </b>
                <span className={styles.state}>
                  {ranked
                    ? tied
                      ? L('Tied {rank} · {n} correct', { rank, n: lane.correct })
                      : L('Place {rank} · {n} correct', { rank, n: lane.correct })
                    : lane.finished
                      ? L('✓ Finished')
                      : lane.frozen
                        ? L('❄ Frozen')
                        : !lane.connected
                          ? L('↻ Reconnecting')
                          : L('{n} / {total} answered', { n: lane.answered, total })}
                </span>
              </div>
            </div>
            <div
              className={styles.track}
              role="progressbar"
              aria-label={L('{name}: questions answered', { name: lane.name })}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={lane.answered}
            >
              <div className={styles.rail} />
              <div className={styles.path}>
                <span className={styles.runner}>
                  <svg viewBox="0 0 40 48" aria-hidden="true">
                    <path d="M23 2 5 27h13l-2 19 19-28H22z" />
                  </svg>
                </span>
              </div>
              <span className={styles.finish} aria-hidden="true">
                <svg viewBox="0 0 40 48" aria-hidden="true">
                  <path d="M6 3h3v42H6z M9 6c9-6 18 6 27 0v22c-9 6-18-6-27 0z" />
                </svg>
              </span>
            </div>
            <div className={styles.score}>
              <b>{lane.score}</b>
              <span>{L('pts')}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
