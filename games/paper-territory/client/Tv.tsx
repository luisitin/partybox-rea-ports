// A full shared map and numbered area rail make loops, risky trails and captures readable together.
import type { CSSProperties, JSX } from 'react';
import { Stage, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { PaperTerritoryTvView } from '../server/index';
import { clockText } from './controls';
import { Map } from './Map';
import { areaPercent, playerInk } from './mapMath';
import { standings } from './standings';
import { SeatBadge } from './SeatBadge';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<PaperTerritoryTvView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(200, view.paused, view.clockHeldAt);
  const left = view.deadline === null ? 0 : Math.max(0, view.deadline - now);
  const seconds = Math.ceil(left / 1000);
  const over = view.phaseId === 'score' || view.phaseId === 'done';
  const rows = standings(view, over);
  const leaders = rows.filter((row) => row.rank === 1);
  const title = over
    ? leaders.length === 1
      ? L('{name} takes the map!', { name: leaders[0]?.name ?? '' })
      : L('A tie for the most territory!')
    : view.phaseId === 'ready'
      ? L('Loop out. Come home. Claim land.')
      : L('Protect your trail');
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.kicker}>{L('Paper Territory')}</p>
          <h2 className={styles.title}>{title}</h2>
        </div>
        {!over ? (
          <div className={styles.clock} role="timer" data-low={seconds <= 5 || undefined}>
            <span>{view.paused ? L('Paused') : L('Time left')}</span>
            <b>{view.phaseId === 'ready' ? seconds : clockText(left)}</b>
          </div>
        ) : null}
      </header>
      <div className={styles.layout}>
        <div className={styles.focal}>
          <div className={styles.arena}>
            <Map
              width={view.width}
              height={view.height}
              owners={view.owners}
              runners={view.runners}
              label={L(
                'Territory map. Numbered discs and direction arrows are players. Each seat has its own land texture. Outlined numbered squares are protected homes. Dashed trails are vulnerable.',
              )}
            />
            {view.phaseId === 'ready' ? (
              <span className={styles.count} aria-live="polite">
                {seconds}
              </span>
            ) : null}
          </div>
          <p className={styles.legend}>
            {over
              ? L('Final territory counts. Your home always stays yours.')
              : L(
                  'Outlined squares are protected homes. Loop back to your land. Cut a rival’s dashed trail.',
                )}
          </p>
        </div>
        <aside className={styles.rail}>
          <h3>{over ? L('Final area') : L('Territory')}</h3>
          <ul className={styles.rows} aria-label={L('Players and territory')}>
            {rows.map((row) => (
              <li
                key={row.id}
                style={{ ['--seat-ink' as string]: playerInk(row.slot) } as CSSProperties}
              >
                <SeatBadge className={styles.seat} slot={row.slot} />
                <div className={styles.person}>
                  <b>{row.name}</b>
                  <span>
                    {over
                      ? L('Place {rank}', { rank: row.rank })
                      : !row.alive
                        ? L('Returning')
                        : row.exposed
                          ? L('Trail out')
                          : L('Home')}
                  </span>
                </div>
                <div className={styles.area}>
                  <b>{areaPercent(row.area, view.width * view.height)}%</b>
                  <span>
                    {row.area} {L('cells')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </Stage>
  );
}
