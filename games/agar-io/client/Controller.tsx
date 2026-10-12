import type { JSX } from 'react';
import { usePhoneOnly, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { BlobArenaControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Arena } from './Arena';
import { clockText, playerStyle, standings } from './display';
import { Joystick } from './Joystick';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<BlobArenaControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const phase = view.phaseId,
    playing = phase === 'play';
  const seat = view.me.role === 'player' && view.slot >= 0;
  const player = seat && view.member && !view.departed;
  const connected =
    view.connected && view.players.some((row) => row.id === view.me.id && row.connected);
  const showStage = phoneOnly || view.arena !== undefined;
  const active = playing && player && connected && view.mass > 0 && !view.paused;
  const ordered = phase === 'score' || phase === 'done';
  const rows = standings(view, ordered);
  const msLeft = view.deadline === null ? 0 : Math.max(0, view.deadline - now);
  const ownPoints = view.scores[view.me.id] ?? 0;
  const winners = rows.filter((row) => row.rank === 1);
  const winnerNames = winners.map((row) => row.name);
  const winnerLine =
    winners.length === 1
      ? L('{name} wins!', { name: winnerNames[0] ?? '' })
      : L('{names} tie for the win!', { names: winnerNames.join(', ') });
  const headline =
    phase === 'done'
      ? winners.length > 2
        ? L('{n} tied winners', { n: winners.length })
        : winnerLine
      : phase === 'score'
        ? L('Round {n} over', { n: view.round })
        : L('Round {n} of {m}', { n: view.round, m: view.rounds });
  let status = L('Watching the arena');
  if (playing) {
    if (view.departed) status = L('You left this match — watching the arena.');
    else if (player && !connected)
      status = L('Disconnected — steering stopped. Reconnect to play.');
    else if (view.paused)
      status = player ? L('Paused — steering stopped') : L('Paused — watching the arena');
    else if (player && view.mass === 0)
      status =
        view.respawnIn > msLeft
          ? L('Swallowed — watching until the round ends.')
          : L('Swallowed! Back in {n}s', { n: Math.max(1, Math.ceil(view.respawnIn / 1000)) });
    else if (player) status = L('Snack to grow. Swallow smaller rivals.');
  } else if (phase === 'score') {
    status = seat
      ? L('+{n} this round · {total} points', {
          n: view.lastPoints[view.me.id] ?? 0,
          total: ownPoints,
        })
      : L('Mass at the buzzer becomes points.');
    status += ` ${view.paused ? L('Paused') : view.round >= view.rounds ? L('Final results in {n}s', { n: Math.ceil(msLeft / 1000) }) : L('Next round in {n}s', { n: Math.ceil(msLeft / 1000) })}`;
  } else if (phase === 'done' && seat && view.rank !== null) {
    status =
      view.rank === 1
        ? winners.length > 1
          ? L('Tied top place! {n} points', { n: ownPoints })
          : L('Top place! {n} points', { n: ownPoints })
        : L('Place {rank} · {n} points', { rank: view.rank, n: ownPoints });
  }
  const contextKey = `${phase}:${view.round}:${view.me.id}:${view.member}:${view.departed}:${connected}:${view.paused}:${view.mass > 0}`;
  return (
    <div
      className={styles.screen}
      style={playerStyle(view.slot)}
      data-stage={showStage ? 'true' : undefined}
      data-controls={playing && player ? 'true' : undefined}
      data-phase={phase}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2
            className={styles.headline}
            title={phase === 'done' ? winnerLine : undefined}
            aria-label={phase === 'done' ? winnerLine : undefined}
          >
            {headline}
          </h2>
          {seat ? (
            <p className={styles.identity}>
              <b className={styles.badge}>{view.slot + 1}</b>
              {ordered || view.departed ? L('Your total') : L('Your blob')} ·{' '}
              <b>
                {ordered || view.departed
                  ? L('{n} points', { n: ownPoints })
                  : L('{n} mass', { n: view.mass })}
              </b>
            </p>
          ) : null}
        </div>
        {playing ? (
          <p className={styles.clock} role="timer" aria-label={L('Time left')}>
            {clockText(msLeft)}
          </p>
        ) : null}
      </header>
      {showStage && view.arena ? (
        <div className={styles.arena}>
          <Arena
            {...view.arena}
            players={view.players}
            slots={view.slots}
            checked={view.checked}
            mine={seat ? view.me.id : undefined}
            frozen={!playing || view.paused}
            phone
            compact={!playing || !player}
          />
        </div>
      ) : null}
      <p className={styles.status} role="status">
        {status}
      </p>
      {playing && player ? (
        <Joystick
          active={active}
          canSplit={view.canSplit}
          reason={!connected ? 'Disconnected' : view.splitReason}
          contextKey={contextKey}
          send={send}
        />
      ) : (
        <div className={styles.standings}>
          <div className={styles.legend}>
            <span>{ordered ? L('Place / player') : L('Players')}</span>
            <span>{playing ? L('Mass') : L('Round / total')}</span>
          </div>
          <ol className={styles.rows} aria-label={L('All players')}>
            {rows.map((row) => (
              <li
                key={row.id}
                style={playerStyle(row.slot)}
                data-me={row.id === view.me.id ? 'true' : undefined}
                data-winner={phase === 'done' && row.rank === 1 ? 'true' : undefined}
              >
                {ordered ? (
                  <b className={styles.rank} aria-label={L('Place {rank}', { rank: row.rank })}>
                    {row.rank}
                  </b>
                ) : null}
                <b className={styles.badge} aria-label={L('Blob {n}', { n: row.slot + 1 })}>
                  {row.slot + 1}
                </b>
                <span className={styles.name} title={row.name}>
                  {row.name}
                </span>
                {row.departed ? (
                  <span className={styles.offline}>{L('Left')}</span>
                ) : !row.connected ? (
                  <span className={styles.offline} aria-label={L('Disconnected')}>
                    ○
                  </span>
                ) : null}
                {ordered ? <span className={styles.gain}>+{row.gained}</span> : null}
                <b className={styles.points}>{playing ? row.mass : row.total}</b>
              </li>
            ))}
          </ol>
        </div>
      )}
      {playing && player ? (
        <p className={styles.footer}>
          {showStage
            ? L('Your number above. Buzzer mass scores.')
            : L('Your number on the TV. Buzzer mass scores.')}
        </p>
      ) : null}
    </div>
  );
}
