import { useEffect, useRef } from 'react';
import type { CSSProperties, JSX } from 'react';
import { Stage, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { BonkTvView } from '../server/index';
import { Arena } from './Arena';
import { finalRoundText } from './roundContext';
import { clockText, playerStyle, secondsLeft, standingsRows } from './standings';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<BonkTvView>): JSX.Element {
  const L = useT(STRINGS);
  const sound = useSound();
  const now = useServerNow(100, view.paused, view.clockHeldAt);
  const seconds = secondsLeft(view.deadline, now);
  const phase = view.phaseId;
  const ranked = phase === 'score' || phase === 'done';
  const rows = standingsRows(view, '', ranked);
  const leaders = rows.filter((row) => row.rank === 1);
  const lastWinners = rows.filter((row) => view.lastWinners.includes(row.id));
  const ticked = useRef('');
  const previous = useRef({ key: '', alive: new Set<string>() });

  useEffect(() => {
    const key = `${view.round}:${phase}:${seconds}`;
    if (
      view.paused ||
      seconds < 1 ||
      ticked.current === key ||
      !(phase === 'ready' || (phase === 'play' && seconds <= 5))
    )
      return;
    ticked.current = key;
    sound('countdown');
  }, [view.round, view.paused, phase, seconds, sound]);

  useEffect(() => {
    const key = `${view.round}:${phase}`;
    const alive = new Set(view.balls.filter((ball) => ball.alive).map((ball) => ball.id));
    if (
      phase === 'play' &&
      !view.paused &&
      previous.current.key === key &&
      view.balls.some((ball) => ball.cause === 'fall' && previous.current.alive.has(ball.id))
    )
      sound('splash', { gain: 0.45 });
    previous.current = { key, alive };
  }, [view.round, phase, view.balls, view.paused, sound]);

  let headline = L('Bump rivals off. Stay on the platform.');
  if (phase === 'score') {
    headline =
      view.roundOutcome === 'draw'
        ? L('Round drawn — no points')
        : lastWinners.length === 1
          ? L('{name} wins the round! +1', { name: lastWinners[0]?.name ?? '' })
          : L('{n} survivors share +1', { n: lastWinners.length });
  } else if (phase === 'done') {
    headline =
      leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('Shared victory!');
  }
  const untilShrink = Math.max(0, Math.ceil((view.began + 15_000 - now) / 1000));
  const hazardText =
    phase === 'done'
      ? finalRoundText(lastWinners, view.roundOutcome, L)
      : phase !== 'play'
        ? L('Last standing wins a point')
        : view.hazard
          ? L('Platforms shrinking — keep moving!')
          : L('Platforms shrink in {n}s', { n: untilShrink });

  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <p className={styles.round}>{L('Round {n} of {m}', { n: view.round, m: view.rounds })}</p>
        <h1 className={styles.headline}>{headline}</h1>
      </header>
      <div className={styles.board}>
        <div className={styles.playfield}>
          <div className={styles.arena}>
            <Arena
              balls={view.balls}
              platforms={view.platforms}
              width={view.arenaWidth}
              height={view.arenaHeight}
              hazard={view.hazard}
            />
            {phase === 'ready' ? (
              <div className={styles.readyCount} aria-live="polite">
                <b>{seconds}</b>
                <span>{L('Find your number')}</span>
              </div>
            ) : null}
          </div>
          <p
            className={styles.rule}
            data-danger={phase === 'play' && view.hazard ? 'true' : undefined}
          >
            {hazardText}
          </p>
        </div>
        <aside className={styles.side}>
          {phase !== 'done' ? (
            <div
              className={styles.clock}
              role="timer"
              data-low={phase === 'play' && seconds <= 5 ? 'true' : undefined}
            >
              <span>
                {phase === 'play'
                  ? L('Time left')
                  : phase === 'ready'
                    ? L('Get ready')
                    : view.round < view.rounds
                      ? L('Next round in')
                      : L('Final results in')}
              </span>
              <b>{clockText(seconds)}</b>
            </div>
          ) : (
            <p className={styles.finalLabel}>{L('Final standings · round wins')}</p>
          )}
          <ul className={styles.rows} aria-label={ranked ? L('Standings') : L('Players')}>
            {rows.map((row) => (
              <li
                key={row.id}
                style={playerStyle(row.slot) as CSSProperties}
                data-out={!row.alive && phase === 'play' ? 'true' : undefined}
                data-winner={phase === 'score' && row.gained > 0 ? 'true' : undefined}
              >
                <span className={styles.badge} aria-label={L('Ball {n}', { n: row.slot + 1 })}>
                  {row.slot + 1}
                </span>
                <div className={styles.identity}>
                  <b className={styles.name}>{row.name}</b>
                  <span className={styles.status}>
                    {ranked
                      ? L('{rank}{tie}', {
                          rank: L('Place {n}', { n: row.rank }),
                          tie: row.tied ? L(' · tied') : '',
                        })
                      : row.departed
                        ? L('Left')
                        : !row.connected
                          ? L('Disconnected')
                          : !row.alive
                            ? L('Out · next round')
                            : row.heavy
                              ? L('Heavy ▰')
                              : L('Rolling')}
                  </span>
                </div>
                {phase === 'score' && row.gained > 0 ? (
                  <span className={styles.gain}>+{row.gained}</span>
                ) : null}
                <b className={styles.points}>{row.total}</b>
              </li>
            ))}
          </ul>
          {phase === 'play' ? (
            <p className={styles.remaining}>
              {L('{n} of {m} still in', { n: view.aliveCount, m: view.total })}
            </p>
          ) : null}
        </aside>
      </div>
    </Stage>
  );
}
