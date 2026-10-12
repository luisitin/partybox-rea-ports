// Phones steer; remote and phone-only players also carry the shared city stage.
import type { JSX } from 'react';
import { usePhoneOnly, useSecondsLeft, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { HoleControllerView, Input } from '../server/types';
import { City } from './City';
import { Joystick } from './Joystick';
import { clockText, playerStyle, standings, targetsFor, winnerLine } from './presentation';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<HoleControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const stage = phoneOnly || view.stage;
  const seconds = useSecondsLeft(view.deadline, view.paused, 250, view.clockHeldAt) ?? 0;
  const playing = view.phaseId === 'play';
  const player = view.me.role === 'player' && view.mine !== null;
  const mine = view.mine;
  const rows = standings(view.city, view.players, view.scores, view.slots);
  const score = mine?.score ?? view.scores[view.me.id] ?? 0;
  const target = targetsFor(mine?.radius ?? 0);
  const respawn = mine !== null && mine.respawnIn > 0;
  const status = view.paused
    ? L('Paused')
    : respawn
      ? L('Back in {n}s', { n: Math.ceil((mine?.respawnIn ?? 0) / 1000) })
      : '';
  const city =
    stage && view.city ? (
      <div className={styles.map}>
        <City city={view.city} mine={player ? view.me.id : undefined} compact />
      </div>
    ) : null;

  if (playing && player && mine !== null) {
    return (
      <div
        className={styles.screen}
        style={playerStyle(view.slot)}
        data-city={city !== null || undefined}
      >
        <header className={styles.header}>
          <span className={styles.identity} aria-hidden="true">
            {view.slot + 1}
          </span>
          <div className={styles.heading}>
            <h2>{L('You are hole {n}', { n: view.slot + 1 })}</h2>
            <p>
              {mine.shield && !respawn
                ? L('Protected · Go collect!')
                : respawn
                  ? L('Your points are safe. Start small again.')
                  : L('Eat what fits. Keep growing.')}
            </p>
          </div>
          <strong
            className={styles.timer}
            role="timer"
            aria-label={L('{n} seconds left', { n: seconds })}
          >
            {clockText(seconds)}
          </strong>
        </header>
        {city}
        <div className={styles.metrics}>
          <div>
            <span>{L('Points')}</span>
            <strong>{score}</strong>
          </div>
          <div className={styles.target}>
            <strong>{L('Eat: {target}', { target: L(target.current) })}</strong>
            <span>
              {target.next
                ? L('Next: {target}', { target: L(target.next) })
                : L('Big enough for every building!')}
            </span>
          </div>
        </div>
        <Joystick send={send} disabled={view.paused || respawn} status={status} />
      </div>
    );
  }

  const headline = playing
    ? L('The city is live')
    : view.phaseId === 'reveal'
      ? L('City closed!')
      : L(winnerLine(rows));
  return (
    <div className={styles.summary} style={playerStyle(view.slot)} data-phase={view.phaseId}>
      <header className={styles.summaryHeading}>
        <h2>{headline}</h2>
        <p>
          {playing
            ? L('Watch the numbered holes grow')
            : player && view.rank !== null
              ? L('Place {rank} · {score} points', { rank: view.rank, score })
              : L('Most points wins')}
        </p>
        {playing ? (
          <strong
            className={styles.watchTimer}
            role="timer"
            aria-label={L('{n} seconds left', { n: seconds })}
          >
            {clockText(seconds)}
          </strong>
        ) : null}
      </header>
      {city}
      <ol className={styles.rows} aria-label={L('Player scores')}>
        {rows.map((r) => (
          <li
            key={r.hole.id}
            style={playerStyle(r.hole.slot)}
            data-me={(player && r.hole.id === view.me.id) || undefined}
          >
            <span
              className={styles.smallIdentity}
              aria-label={L('Hole {n}', { n: r.hole.slot + 1 })}
            >
              {r.hole.slot + 1}
            </span>
            <span className={styles.rowName}>
              <b title={r.name}>{r.name}</b>
              <small>{L('Place {n}', { n: r.rank })}</small>
            </span>
            <strong>{r.hole.score}</strong>
          </li>
        ))}
      </ol>
      {rows.length === 0 ? (
        <p className={styles.empty}>{L('The city is waiting for players.')}</p>
      ) : null}
      {!playing ? <p className={styles.finishNote}>{L('Small bites built a big score.')}</p> : null}
    </div>
  );
}
