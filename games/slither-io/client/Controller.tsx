// The arena travels with phone-only and remote views. Spectators get the whole stage without controls.
import type { JSX } from 'react';
import { usePhoneOnly, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { SnakeControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Arena } from './Arena';
import { Controls } from './Controls';
import { Standings } from './Standings';
import { standingsRows } from './standingsRows';
import { STRINGS } from './strings';
import { clockText, playerStyle } from './timing';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<SnakeControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const playing = view.phaseId === 'play';
  const finalRound = view.round >= view.rounds;
  const player = view.me.role === 'player';
  const showStage = phoneOnly || view.world !== undefined || !player;
  const enabled = playing && player && view.alive && !view.paused;
  const rows = standingsRows(view, !playing);
  const leaders = rows.filter((row) => row.total === (rows[0]?.total ?? 0));
  const points = view.scores[view.me.id] ?? 0;
  const headline = playing
    ? L('Round {n} of {m}', { n: view.round, m: view.rounds })
    : view.phaseId === 'score'
      ? L('Round {n} banked!', { n: view.round })
      : leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the top!');
  const msLeft = Math.max(0, (playing ? view.endsAt : (view.deadline ?? now)) - now);
  const respawnSeconds = Math.max(1, Math.ceil(view.respawnIn / 1000));
  return (
    <section
      className={styles.screen}
      style={playerStyle(view.slot)}
      data-stage={showStage || undefined}
      data-phase={view.phaseId}
    >
      <header className={styles.header}>
        <h1 className={styles.title} title={headline}>
          {headline}
        </h1>
        {view.phaseId !== 'done' ? (
          <div
            className={styles.clock}
            role="timer"
            aria-label={
              playing ? L('Time left') : finalRound ? L('Final results') : L('Next round')
            }
          >
            {clockText(msLeft)}
          </div>
        ) : null}
      </header>
      {player ? (
        <div className={styles.stats}>
          <span className={styles.seat}>
            <b>{Math.max(0, view.slot) + 1}</b>
            {L('Your snake')}
          </span>
          <span>
            <b>{Math.floor(view.mass)}</b>
            {L('Size')}
          </span>
          <span>
            <b>{points}</b>
            {L('Match points')}
          </span>
        </div>
      ) : (
        <p className={styles.spectating}>{L('Spectating · grow, crash, return')}</p>
      )}
      {showStage && view.world ? (
        <div className={styles.arena}>
          <Arena
            world={view.world}
            names={new Map(view.players.map((person) => [person.id, person.name]))}
            me={player ? view.me.id : undefined}
          />
        </div>
      ) : playing ? (
        <div className={styles.identity}>
          <span className={styles.snakeNumber}>{Math.max(0, view.slot) + 1}</span>
          <h2>{L('You are snake {n}', { n: Math.max(0, view.slot) + 1 })}</h2>
          <p>{L('Eat sparks. Avoid walls and other snakes.')}</p>
          <p>{L('Your size at the buzzer becomes points.')}</p>
        </div>
      ) : null}
      {showStage || !playing ? (
        <Standings rows={rows} phase={view.phaseId} compact me={player ? view.me.id : undefined} />
      ) : null}
      {playing && player ? (
        <>
          {!view.alive || view.paused ? (
            <p className={styles.notice} role="status">
              {view.paused
                ? L('Paused · controls released')
                : L('Crashed! Back in {n}s with a shield.', { n: respawnSeconds })}
            </p>
          ) : null}
          <Controls
            key={view.round}
            angle={view.angle}
            mass={view.mass}
            enabled={enabled}
            send={send}
          />
          {!showStage ? (
            <p className={styles.hint}>
              {L('Drag to steer · Arrow keys / WASD · Space / Shift to boost')}
            </p>
          ) : null}
        </>
      ) : playing ? (
        <p className={styles.hint}>{L('● Sparks · ◆ Rich crash food · Dashed ring = shield')}</p>
      ) : (
        <div className={styles.result} role="status">
          {player ? (
            <b>
              {view.phaseId === 'score'
                ? L('+{n} from your end size', { n: view.lastPoints[view.me.id] ?? 0 })
                : L('Place {rank} · {n} match points', { rank: view.rank ?? 1, n: points })}
            </b>
          ) : null}
          <p>
            {view.phaseId === 'score'
              ? finalRound
                ? L('All rounds banked. Final results coming up.')
                : L('Next round starts automatically. A fresh snake, another chance.')
              : L('Most match points wins. Thanks for growing!')}
          </p>
        </div>
      )}
    </section>
  );
}
