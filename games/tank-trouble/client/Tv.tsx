// The public maze is the stage's one focal point; the rail keeps every numbered seat and a readable round clock.
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { Stage, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { TankTroubleTvView } from '../server/index';
import { Arena } from './Arena';
import { Standings } from './Standings';
import { RoundResult } from './RoundResult';
import { STRINGS } from './strings';
import { clockText, weaponName, WEAPON_MARKS } from './timing';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<TankTroubleTvView>): JSX.Element {
  const L = useT(STRINGS);
  const sound = useSound();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const phase = view.phaseId;
  const left = view.deadline === null ? 0 : Math.max(0, view.deadline - now);
  const seconds = Math.ceil(left / 1000);
  const ticked = useRef('');
  const previous = useRef({ round: view.round, alive: view.aliveCount, phase });
  useEffect(() => {
    const key = `${view.round}:${phase}:${seconds}`;
    const ticking = phase === 'ready' || (phase === 'play' && seconds <= 5);
    if (ticking && seconds > 0 && !view.paused && key !== ticked.current) {
      ticked.current = key;
      sound('countdown');
    }
    if (
      (phase === 'play' || (phase === 'score' && previous.current.phase === 'play')) &&
      !view.paused &&
      previous.current.round === view.round &&
      view.aliveCount < previous.current.alive
    )
      sound('thud', { quiet: true, gain: 0.6 });
    previous.current = { round: view.round, alive: view.aliveCount, phase };
  }, [view.round, view.aliveCount, view.paused, phase, seconds, sound]);

  if (phase === 'ready')
    return (
      <Stage className={styles.stage}>
        <div className={styles.interlude}>
          <h2 className={styles.headline}>{L('Round {n}', { n: view.round })}</h2>
          <div className={styles.readyArena}>
            <Arena arena={view.arena} players={view.players} />
            <div className={styles.countdown} role="timer">
              {Math.max(1, seconds)}
            </div>
          </div>
          <p className={styles.line}>{view.paused ? L('Paused') : L('Find your tank')}</p>
        </div>
      </Stage>
    );
  if (phase === 'score')
    return (
      <Stage className={styles.stage}>
        <RoundResult view={view} seconds={seconds} />
      </Stage>
    );

  let headline = L('Round {n} of {m}', { n: view.round, m: view.rounds });
  let line = L('Last tank standing wins. Your shells can hit you.');
  if (phase === 'done') {
    headline = L('Final standings');
    line =
      view.winnerIds.length === 1
        ? L('{name} wins the match!', {
            name:
              view.players.find((player) => player.id === view.winnerIds[0])?.name ?? L('Player'),
          })
        : L('A tie at the top!');
  }
  return (
    <Stage className={styles.stage}>
      <div className={styles.board}>
        <div className={styles.main}>
          <div className={styles.arena}>
            <Arena
              arena={view.arena}
              players={view.players}
              animated={phase === 'play' && !view.paused}
            />
          </div>
          <p className={styles.line}>{line}</p>
          {view.powerupsEnabled ? (
            <p className={styles.legend}>
              {Object.entries(WEAPON_MARKS).map(([kind, mark]) => (
                <span key={kind}>
                  <svg
                    className={styles.legendMark}
                    viewBox="-3 -3 6 6"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d={mark} />
                  </svg>
                  {weaponName(kind, L)}
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <aside className={styles.rail}>
          <h2 className={styles.headline}>{headline}</h2>
          {phase === 'play' ? (
            <div className={styles.clock} role="timer" data-low={seconds <= 5 || undefined}>
              <span>{view.paused ? L('Paused') : L('Time left')}</span>
              <b>{clockText(left)}</b>
            </div>
          ) : null}
          <p className={styles.alive}>
            {phase === 'play'
              ? L('{n} of {m} still in', { n: view.aliveCount, m: view.total })
              : L('Round wins')}
          </p>
          <Standings view={view} />
        </aside>
      </div>
    </Stage>
  );
}
