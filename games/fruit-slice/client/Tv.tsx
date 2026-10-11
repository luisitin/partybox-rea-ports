// One shared fountain is the focal point. Personal cuts never remove another player's fruit.
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { Stage, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { SliceTvView } from '../server/types';
import { Fountain } from './Fountain';
import { Standings } from './Standings';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<SliceTvView>): JSX.Element {
  const L = useT(STRINGS);
  const sound = useSound();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const running = view.phaseId === 'play';
  const seconds =
    running && view.deadline !== null
      ? Math.max(0, Math.ceil((view.deadline - now) / 1000))
      : view.seconds;
  const ticked = useRef(seconds);
  useEffect(() => {
    if (running && !view.paused && seconds > 0 && seconds <= 5 && seconds !== ticked.current)
      sound('countdown');
    ticked.current = seconds;
  }, [running, view.paused, seconds, sound]);
  const top = Math.max(0, ...view.rows.map((row) => row.score));
  const leaders = view.rows.filter((row) => row.score === top);
  const title = running
    ? L('Fruit Slice')
    : view.phaseId === 'score'
      ? L('Time’s up!')
      : leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]!.name })
        : L('A tie at the top!');
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.intro}>
          <h2>{title}</h2>
          <p>
            {running
              ? L('Same fountain. Your own fruit. Swipe on your phone.')
              : L('Your biggest combo is beside your points.')}
          </p>
        </div>
        {running ? (
          <div
            className={styles.clock}
            role="timer"
            aria-label={L('{n} seconds left', { n: seconds })}
            data-low={seconds <= 5 ? 'true' : undefined}
          >
            <span>{L('Time left')}</span>
            <strong>{seconds}</strong>
          </div>
        ) : null}
      </header>
      <div className={styles.board}>
        <div className={styles.arenaSlot}>
          <div className={styles.arena}>
            <Fountain targets={view.targets} label={L('Shared fruit fountain. X marks a bomb.')} />
            {!running ? (
              <p className={styles.finished}>{L('60 seconds. Every slice counts.')}</p>
            ) : null}
          </div>
        </div>
        <Standings rows={view.rows} final={!running} />
      </div>
      <p className={styles.legend}>
        {running
          ? L(
              '3+ fruit in one swipe = DOUBLE · Safe waves build streaks · X bombs reset your streak',
            )
          : L('Highest points wins · Missed waves reset streaks · Nobody is eliminated')}
      </p>
    </Stage>
  );
}
