import { useEffect, useRef } from 'react';
import type { CSSProperties, JSX } from 'react';
import { Stage, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { SkylineTvView } from '../server/index';
import { Tower } from './Tower';
import { clockText, feedbackKey, seatStyle, slotOf } from './display';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<SkylineTvView>): JSX.Element {
  const L = useT(STRINGS);
  const play = useSound();
  const now = useServerNow(50, view.paused, view.clockHeldAt);
  const active = view.phaseId === 'play';
  const left = Math.max(0, view.endsAt - now);
  const seconds = Math.ceil(left / 1000);
  const ticked = useRef(0);
  useEffect(() => {
    if (!active || view.paused || seconds > 5 || seconds < 1 || ticked.current === seconds) return;
    ticked.current = seconds;
    play('countdown');
  }, [active, view.paused, seconds, play]);
  const top = Math.max(0, ...view.towers.map((tower) => tower.best));
  const leaders = view.towers.filter((tower) => tower.best === top);
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const headline = active
    ? L('Skyline Stack')
    : leaders.length === 1
      ? L('{name} built the tallest tower!', { name: names.get(leaders[0]?.id ?? '') ?? '' })
      : L('A tie at the skyline!');
  const columns = Math.min(4, Math.max(1, view.towers.length));
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{headline}</h2>
          <p className={styles.subtitle}>
            {active
              ? L('Drop to align · 3 perfects restore width · Your best survives a miss')
              : L('Best height wins · {n} floors at the top', { n: top })}
          </p>
        </div>
        {active ? (
          <div className={styles.clock} role="timer" data-low={seconds <= 5 || undefined}>
            <span className={styles.clockLabel}>{L('Time left')}</span>
            <strong>{clockText(left)}</strong>
          </div>
        ) : null}
      </header>
      <ol
        className={styles.skyline}
        style={{ ['--tower-columns' as string]: columns } as CSSProperties}
        aria-label={L('All towers')}
      >
        {view.towers.map((tower) => {
          const slot = slotOf(view.slots, tower.id);
          const name = names.get(tower.id) ?? '';
          const leading = tower.best === top && top > 0;
          const rank = 1 + view.towers.filter((t) => t.best > tower.best).length;
          const feedback =
            tower.crashedAt !== null
              ? L('✕ Rebuild — best saved')
              : now - tower.lastAt < 900 && tower.feedback !== 'align'
                ? L.sent(feedbackKey(tower.feedback))
                : L('Align and drop');
          return (
            <li
              key={tower.id}
              className={styles.bay}
              style={seatStyle(slot)}
              data-leader={leading || undefined}
            >
              <div className={styles.player}>
                <span className={styles.seat}>{slot + 1}</span>
                <h3 className={styles.name}>{name}</h3>
                {leading ? <span className={styles.lead}>{L('LEAD')}</span> : null}
              </div>
              <div className={styles.art}>
                <Tower
                  tower={tower}
                  now={active ? Math.min(now, view.endsAt) : view.checked}
                  course={view.course}
                  active={active}
                  best={!active}
                  name={name}
                />
              </div>
              <div className={styles.metrics}>
                <span>
                  {active ? L('Now {n}', { n: tower.height }) : L('Place {rank}', { rank })}
                </span>
                <strong>{L('Best {n}', { n: tower.best })}</strong>
              </div>
              <p className={styles.feedback}>
                {active ? feedback : L('{n} perfect drops', { n: tower.perfects })}
              </p>
            </li>
          );
        })}
      </ol>
    </Stage>
  );
}
