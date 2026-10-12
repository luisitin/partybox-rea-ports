// The stage keeps the shared arena visible through every round and its scored pause.
import type { JSX } from 'react';
import { Stage, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { BlobArenaTvView } from '../server/index';
import { Arena } from './Arena';
import { clockText, playerStyle, standings } from './display';
import { STRINGS } from './strings';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<BlobArenaTvView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const playing = view.phaseId === 'play';
  const rows = standings(view, !playing);
  const msLeft = view.deadline === null ? 0 : Math.max(0, view.deadline - now);
  let headline = playing
    ? L('Round {n} of {m}', { n: view.round, m: view.rounds })
    : L('Round {n} over', { n: view.round });
  let winnerLabel: string | undefined;
  if (view.phaseId === 'done') {
    const top = Math.max(0, ...rows.map((row) => row.total));
    const winners = rows.filter((row) => row.total === top).map((row) => row.name);
    winnerLabel =
      winners.length === 1
        ? L('{name} wins!', { name: winners[0] ?? '' })
        : L('{names} tie for the win!', { names: winners.join(', ') });
    headline =
      winners.length === 1
        ? L('{name} wins!', { name: winners[0] ?? '' })
        : winners.length > 2
          ? L('{n} tied winners', { n: winners.length })
          : L('{names} tie for the win!', { names: winners.join(', ') });
  }
  return (
    <Stage className={styles.stage}>
      {view.phaseId === 'done' ? (
        <h2 className={styles.matchHeadline} title={winnerLabel} aria-label={winnerLabel}>
          {headline}
        </h2>
      ) : null}
      <div className={styles.board}>
        <div className={styles.field}>
          <Arena
            cells={view.cells}
            pellets={view.pellets}
            players={view.players}
            slots={view.slots}
            checked={view.checked}
            frozen={!playing || view.paused}
          />
        </div>
        <aside className={styles.side}>
          {view.phaseId !== 'done' ? <h2 className={styles.headline}>{headline}</h2> : null}
          {playing ? (
            <div
              className={styles.clock}
              role="timer"
              data-low={msLeft <= 5000 ? 'true' : undefined}
            >
              <span className={styles.clockLabel}>
                {view.paused ? L('Paused') : L('Time left')}
              </span>
              <b className={styles.clockValue}>{clockText(msLeft)}</b>
            </div>
          ) : null}
          <div className={styles.standings} data-standings="tv">
            <div className={styles.legend}>
              <span data-column="player">{L('Players')}</span>
              <span data-column="round">{playing ? L('Mass') : L('Round')}</span>
              <span data-column="total">{L('Total')}</span>
            </div>
            <ol className={styles.rows} aria-label={L('All players')}>
              {rows.map((row) => (
                <li
                  key={row.id}
                  style={playerStyle(row.slot)}
                  data-returning={
                    playing && row.mass === 0 && !row.departed && row.connected ? 'true' : undefined
                  }
                >
                  <div className={styles.player}>
                    <b className={styles.badge}>{row.slot + 1}</b>
                    <span className={styles.name} title={row.name}>
                      {row.name}
                    </span>
                    {row.departed ? (
                      <span className={styles.offline}>{L('Left')}</span>
                    ) : !row.connected ? (
                      <span className={styles.offline} aria-label={L('Disconnected')}>
                        {L('Offline')}
                      </span>
                    ) : null}
                  </div>
                  <span className={styles.value} data-column="round">
                    {playing
                      ? row.mass === 0 && !row.departed && row.connected
                        ? L('↻')
                        : row.mass
                      : `+${row.gained}`}
                  </span>
                  <b className={styles.total} data-column="total">
                    {row.total}
                  </b>
                </li>
              ))}
            </ol>
          </div>
          {view.phaseId === 'score' ? (
            <p className={styles.hint}>{L('Mass at the buzzer becomes points.')}</p>
          ) : null}
          <p className={styles.hint}>
            {playing
              ? L('Snack to grow · Split to lunge')
              : view.phaseId === 'done'
                ? L('Three rounds. Biggest total wins.')
                : view.round >= view.rounds
                  ? L('Final results follow shortly.')
                  : L('Next round starts shortly.')}
          </p>
          {playing && rows.some((row) => row.mass === 0 && !row.departed && row.connected) ? (
            <p className={styles.hint}>{L('↻ Swallowed blobs return in 3s.')}</p>
          ) : null}
        </aside>
      </div>
    </Stage>
  );
}
