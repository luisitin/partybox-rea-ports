import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { Stage, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { DinoDashTvView } from '../server/index';
import { clockText, raceTime, standingsRows } from './display';
import { Race } from './Race';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<DinoDashTvView>): JSX.Element {
  const L = useT(STRINGS);
  const sound = useSound();
  const now = useServerNow(33, view.paused, view.clockHeldAt);
  const playing = view.phaseId === 'play';
  const t = raceTime(view, now, playing && !view.paused);
  const left = Math.max(0, view.endsAt - now);
  const seconds = Math.ceil(left / 1000);
  const alive = view.runners.filter((runner) => runner.died === null).length;
  const rows = standingsRows(view);
  const leaders = rows.filter((row) => row.rank === 1);
  const title = playing
    ? L('Round {n} of {m}', { n: view.round, m: view.rounds })
    : view.phaseId === 'score'
      ? L('Round {n} complete', { n: view.round })
      : leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('Shared winners!');
  const ticked = useRef('');
  useEffect(() => {
    const key = `${view.round}:${seconds}`;
    if (!playing || view.paused || seconds > 5 || seconds < 1 || ticked.current === key) return;
    ticked.current = key;
    sound('countdown');
  }, [playing, seconds, sound, view.paused, view.round]);
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          <p>
            {playing
              ? L('{n} of {m} still running', { n: alive, m: view.runners.length })
              : L('Match standings · Round + · Total metres')}
          </p>
        </div>
        {playing ? (
          <div
            className={styles.clock}
            role="timer"
            aria-label={L('Time left')}
            data-low={seconds <= 5 ? 'true' : undefined}
          >
            <span>{L('Time left')}</span>
            <b>{clockText(left)}</b>
          </div>
        ) : null}
      </header>
      <div className={styles.content}>
        <Race view={view} t={t} tv results={!playing} />
      </div>
      <p className={styles.footer}>
        {playing
          ? L('Tap JUMP for rocks · Hold DUCK for birds')
          : view.phaseId === 'score' && view.round < view.rounds
            ? L('Next run: a new course, the same course for everyone')
            : L('Equal metres share a rank')}
      </p>
    </Stage>
  );
}
