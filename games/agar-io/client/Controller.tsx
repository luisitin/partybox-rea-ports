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
  const phase = view.phaseId;
  const playing = phase === 'play';
  const player = view.me.role === 'player' && view.slot >= 0 && view.splitReason !== 'Watching';
  // A remote phone gets the arena even when the room has a TV. The same stage is also safe for spectators.
  const showStage = phoneOnly || view.arena !== undefined;
  const active = playing && player && view.mass > 0 && !view.paused;
  const ordered = phase === 'score' || phase === 'done';
  const rows = standings(view, ordered);
  const msLeft = view.deadline === null ? 0 : Math.max(0, view.deadline - now);
  const ownPoints = view.scores[view.me.id] ?? 0;
  const won = phase === 'done' && view.rank === 1;
  let headline = L('Round {n} of {m}', { n: view.round, m: view.rounds });
  if (phase === 'score') headline = L('Round {n} over', { n: view.round });
  if (phase === 'done') {
    const top = Math.max(0, ...rows.map((row) => row.total));
    const winners = rows.filter((row) => row.total === top).map((row) => row.name);
    headline =
      winners.length === 1
        ? L('{name} wins!', { name: winners[0] ?? '' })
        : L('{names} tie for the win!', { names: winners.join(', ') });
  }
  let status = player ? L('Snack to grow. Swallow smaller rivals.') : L('Watching the arena');
  if (view.paused) status = L('Paused — steering is held');
  else if (playing && player && view.mass === 0)
    status = L('Swallowed! Back in {n}s', { n: Math.max(1, Math.ceil(view.respawnIn / 1000)) });
  else if (phase === 'score' && player)
    status = L('+{n} this round · {total} points', {
      n: view.lastPoints[view.me.id] ?? 0,
      total: ownPoints,
    });
  else if (phase === 'done' && player && view.rank !== null)
    status = won
      ? L('Top place! {n} points', { n: ownPoints })
      : L('Place {rank} · {n} points', { rank: view.rank, n: ownPoints });
  else if (!playing) status = L('Mass at the buzzer becomes points.');
  if (phase === 'score' && view.round >= view.rounds && !view.paused)
    status = `${status} ${L('Final results follow shortly.')}`;

  return (
    <div
      className={styles.screen}
      style={playerStyle(view.slot)}
      data-stage={showStage ? 'true' : undefined}
      data-controls={playing && player ? 'true' : undefined}
      data-phase={phase}
    >
      <header className={styles.header}>
        <div>
          <h2 className={styles.headline}>{headline}</h2>
          {player ? (
            <p className={styles.identity}>
              <b className={styles.badge}>{view.slot + 1}</b>
              {L('Your blob')} · <b>{L('{n} mass', { n: view.mass })}</b>
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
            mine={player ? view.me.id : undefined}
            frozen={!playing || view.paused}
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
          reason={view.splitReason}
          roundKey={`${phase}:${view.round}`}
          send={send}
        />
      ) : (
        <div className={styles.standings}>
          <div className={styles.legend}>
            <span>{L('Players')}</span>
            <span>{playing ? L('Mass') : L('Round / total')}</span>
          </div>
          <ol className={styles.rows} aria-label={L('All players')}>
            {rows.map((row) => (
              <li
                key={row.id}
                style={playerStyle(row.slot)}
                data-me={row.id === view.me.id ? 'true' : undefined}
              >
                <b className={styles.badge}>{row.slot + 1}</b>
                <span className={styles.name}>{row.name}</span>
                {!row.connected ? (
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
            ? L('Find your number above. Mass at the buzzer scores.')
            : L('Find your number on the TV. Mass at the buzzer scores.')}
        </p>
      ) : null}
    </div>
  );
}
