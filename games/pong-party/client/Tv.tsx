import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { Stage, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { PongPartyTvView } from '../server/index';
import { Arena } from './Arena';
import { clockText, slotStyle, standingsRows } from './standings';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<PongPartyTvView>): JSX.Element {
  const L = useT(STRINGS);
  const playSound = useSound();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const playing = view.phaseId === 'play';
  const msLeft = Math.max(0, view.endsAt - now);
  const secondsLeft = Math.ceil(msLeft / 1000);
  const ticked = useRef(-1);
  useEffect(() => {
    if (
      !playing ||
      view.paused ||
      secondsLeft > 5 ||
      secondsLeft < 1 ||
      ticked.current === secondsLeft
    )
      return;
    ticked.current = secondsLeft;
    playSound('countdown');
  }, [playing, view.paused, secondsLeft, playSound]);
  const rows = standingsRows(view, '', !playing);
  const winnerNames = rows.filter((r) => view.winnerIds.includes(r.id)).map((r) => r.name);
  const headline = playing
    ? L('Octo Rally')
    : winnerNames.length === 1
      ? L('{name} wins!', { name: winnerNames[0] ?? '' })
      : L('A shared victory!');
  const liveBalls = view.world.balls.filter((ball) => ball.readyAt <= view.checked).length;

  return (
    <Stage className={styles.stage}>
      <div className={styles.board}>
        <div className={styles.arenaBox}>
          <Arena world={view.world} checked={view.checked} />
          {playing ? (
            <p className={styles.arenaCaption}>
              {L('{n} of {m} still defending', { n: view.aliveCount, m: view.total })}
              <span aria-hidden="true"> · </span>
              {liveBalls === 1 ? L('1 ball') : L('{n} balls', { n: liveBalls })}
            </p>
          ) : null}
        </div>
        <aside className={styles.side}>
          <h2 className={styles.title}>{headline}</h2>
          {playing ? (
            <div
              className={styles.clock}
              role="timer"
              data-low={secondsLeft <= 5 ? 'true' : undefined}
            >
              <span className={styles.clockLabel}>{L('Time left')}</span>
              <span className={styles.clockValue}>{clockText(msLeft)}</span>
            </div>
          ) : (
            <p className={styles.rule}>{L('Most lives wins. Saves break ties.')}</p>
          )}
          <div className={styles.standings}>
            <div className={styles.rowHead} aria-hidden="true">
              <span>{L('Player')}</span>
              <span>{L('Lives')}</span>
              <span>{L('Saves')}</span>
            </div>
            <ul className={styles.rows} aria-label={L('Players, lives and saves')}>
              {rows.map((row) => (
                <li
                  key={row.id}
                  style={slotStyle(row.slot)}
                  data-out={row.out ? 'true' : undefined}
                >
                  <span className={styles.slot} aria-label={L('Paddle {n}', { n: row.slot + 1 })}>
                    {row.slot + 1}
                  </span>
                  <b className={styles.name}>
                    {row.name}
                    {view.winnerIds.includes(row.id) ? (
                      <span className={styles.winner} aria-label={L('Winner')}>
                        ★
                      </span>
                    ) : null}
                  </b>
                  <span
                    className={styles.rowStats}
                    aria-label={
                      row.out
                        ? L('Out')
                        : row.lives === 1
                          ? L('1 life')
                          : L('{n} lives', { n: row.lives })
                    }
                  >
                    {row.out ? L('Out') : row.lives}
                  </span>
                  <span
                    className={styles.rowStats}
                    aria-label={row.saves === 1 ? L('1 save') : L('{n} saves', { n: row.saves })}
                  >
                    {row.saves}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {playing ? <p className={styles.rule}>{L('Slide to defend your edge.')}</p> : null}
        </aside>
      </div>
    </Stage>
  );
}
