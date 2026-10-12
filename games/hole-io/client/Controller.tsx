// Every participating phone has its own close camera, including phones beside the TV.
import type { JSX } from 'react';
import { useSecondsLeft, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { HoleControllerView, Input } from '../server/types';
import { City } from './City';
import { Joystick } from './Joystick';
import { clockText, playerStyle, standings, targetsFor, watchingLeader } from './presentation';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<HoleControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const seconds = useSecondsLeft(view.deadline, view.paused, 250, view.clockHeldAt) ?? 0;
  const playing = view.phaseId === 'play';
  const mine = view.mine;
  const player = view.me.role === 'player' && mine !== null;
  const steering = player && view.participating && mine.alive && !mine.left;
  const rows = standings(view.city, view.players, view.scores, view.slots);
  const leader = watchingLeader(rows);
  const score = mine?.score ?? view.scores[view.me.id] ?? 0;
  const name = view.players.find((p) => p.id === view.me.id)?.name ?? L('Your hole');
  const target = targetsFor(mine?.radius ?? 0);
  const disconnected = mine?.connected === false;
  const status = view.paused ? L('Paused') : disconnected ? L('Disconnected') : '';
  const cameraId = steering ? view.me.id : leader?.hole.id;

  if (playing && steering) {
    return (
      <div
        className={styles.screen}
        style={playerStyle(view.slot)}
        data-city="true"
        data-phase="play"
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2>{name}</h2>
            <p>{L('{n} points', { n: score })}</p>
          </div>
          <div className={styles.clock}>
            <span>{L(view.paused ? 'Paused' : 'Time left')}</span>
            <strong
              className={styles.timer}
              role="timer"
              aria-label={L('{n} seconds left', { n: seconds })}
            >
              {clockText(seconds)}
            </strong>
          </div>
        </header>
        <div className={styles.map} data-camera-id={cameraId}>
          <City
            city={view.city}
            mine={cameraId}
            compact
            players={view.players}
            elapsed={view.elapsed}
            label={L('Your close city view')}
          />
        </div>
        <div className={styles.metrics}>
          <div className={styles.size}>
            <strong>{L('Size {n}', { n: mine.level })}</strong>
            <meter
              min={0}
              max={1}
              value={mine.levelProgress}
              aria-label={L('Growth to the next size')}
            />
          </div>
          <div className={styles.target}>
            <strong>{L('Eat: {target}', { target: L(target.current) })}</strong>
            <span>{mine.shield ? L('Protected briefly') : L('Bigger holes can swallow you')}</span>
          </div>
        </div>
        <Joystick send={send} disabled={view.paused || disconnected} status={status} />
      </div>
    );
  }

  if (playing) {
    const lost = player && mine !== null;
    const headline = lost
      ? L(mine.left ? 'You left the round' : 'You were swallowed!')
      : L('Watching the city');
    return (
      <div
        className={styles.watch}
        style={playerStyle(view.slot)}
        data-phase="play"
        data-city="true"
      >
        <header className={styles.watchHeading}>
          <h2>{headline}</h2>
          <p>{lost ? L('{n} points banked', { n: score }) : L('Most points wins')}</p>
          <div className={styles.watchClock}>
            <span>{L(view.paused ? 'Paused' : 'Time left')}</span>
            <strong role="timer" aria-label={L('{n} seconds left', { n: seconds })}>
              {clockText(seconds)}
            </strong>
          </div>
        </header>
        <div className={styles.map} data-camera-id={cameraId ?? 'none'}>
          <City
            city={view.city}
            mine={cameraId}
            compact
            players={view.players}
            elapsed={view.elapsed}
            label={L('Live city view')}
          />
        </div>
        <div className={styles.watchNote} role="status">
          <p>
            {leader ? L('Following {name}', { name: leader.name }) : L('No holes left in the city')}
          </p>
          <p>{L('Final scores at the end of the clock.')}</p>
        </div>
      </div>
    );
  }

  const winners = rows.filter((row) => row.rank === 1);
  return (
    <div className={styles.summary} style={playerStyle(view.slot)} data-phase={view.phaseId}>
      <header className={styles.summaryHeading}>
        <h2>{L(winners.length > 1 ? 'Tied winners' : 'Winner')}</h2>
        <p>
          {player && view.rank !== null
            ? L('Your place: {rank} ? {score} points', { rank: view.rank, score })
            : L('Final standings')}
        </p>
      </header>
      <ol className={styles.rows} aria-label={L('Final standings')}>
        {rows.map((row) => (
          <li
            key={row.hole.id}
            style={playerStyle(row.hole.slot)}
            data-player-id={row.hole.id}
            data-me={(player && row.hole.id === view.me.id) || undefined}
            data-winner={row.rank === 1 || undefined}
            aria-label={L('{name}, place {rank}, {score} points', {
              name: row.name,
              rank: row.rank,
              score: row.hole.score,
            })}
          >
            <b className={styles.rowName}>{row.name}</b>
            <span>{L('Place {n}', { n: row.rank })}</span>
            <strong>{row.hole.score}</strong>
            {row.rank === 1 ? <small className={styles.winner}>{L('Winner')}</small> : null}
          </li>
        ))}
      </ol>
      {rows.length === 0 ? (
        <p className={styles.empty}>{L('The city is waiting for players.')}</p>
      ) : null}
      <p className={styles.finishNote}>{L('Banked points decide the winners.')}</p>
    </div>
  );
}
