import type { JSX } from 'react';
import {
  buzz,
  usePhoneOnly,
  usePrefersReducedMotion,
  useServerNow,
  useT,
} from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { FlappyControllerView } from '../server/index';
import type { Input } from '../server/world';
import { Arena } from './Arena';
import { standingsRows } from './standings';
import { STRINGS } from './strings';
import { clockText, laneStyle, visualTime } from './timing';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<FlappyControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const reduced = usePrefersReducedMotion();
  const now = useServerNow(33, view.paused, view.clockHeldAt);
  const player = view.me.role === 'player';
  const playing = view.phaseId === 'play';
  const ranked = !playing;
  const rows = standingsRows(view, view.me.id, ranked);
  const myRow = rows.find((row) => row.me);
  const own = view.mine;
  const flying = playing && player && own !== null && own.died === null;
  const stage =
    phoneOnly ||
    (!player && view.birds !== undefined) ||
    (view.birds !== undefined && view.gates !== undefined);
  const t = visualTime(view.began, view.checked, now, !playing || view.paused || reduced);
  const total = view.scores[view.me.id] ?? 0;
  const top = Math.max(0, ...rows.map((row) => row.total));
  const leaders = rows.filter((row) => row.total === top);
  const title = playing
    ? player
      ? flying
        ? L('Lane {n} · {name}', { n: view.slot + 1, name: myRow?.name ?? '' })
        : L('You crashed')
      : L('Watch the flight')
    : view.phaseId === 'score'
      ? L('Round {n} complete', { n: view.round })
      : leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the top!');
  const hint = playing
    ? L('Round {r} · {n} of {m} flying', { r: view.round, n: view.aliveCount, m: rows.length })
    : player
      ? view.phaseId === 'score'
        ? L('+{n} this round · {m} total', { n: view.lastPoints[view.me.id] ?? 0, m: total })
        : view.rank === 1
          ? view.tied
            ? L('You share the win! · {n} points', { n: total })
            : L('You won! · {n} points', { n: total })
          : L('Place {rank} · {n} points', { rank: view.rank ?? 0, n: total })
      : L('Three rounds · one shared course');
  const flap = (): void => {
    if (!flying || view.paused) return;
    buzz(8);
    send({ type: 'flap' });
  };

  return (
    <div
      className={styles.screen}
      style={laneStyle(Math.max(0, view.slot))}
      data-stage={stage ? 'true' : undefined}
      data-spectator={!player ? 'true' : undefined}
    >
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.meta}>
          <span aria-live="polite">{hint}</span>
          {playing ? (
            <strong role="timer">{clockText(Math.max(0, view.endsAt - now))}</strong>
          ) : null}
        </div>
      </header>
      {stage && player && own && view.gates ? (
        <div className={styles.arena}>
          <Arena
            bird={own}
            gates={view.gates}
            time={t}
            reduced={reduced}
            label={L('Your lane {n}', { n: view.slot + 1 })}
          />
        </div>
      ) : null}
      {stage && !player && view.birds && view.gates ? (
        <div className={styles.spectatorLanes}>
          {view.birds.map((bird, slot) => {
            const row = rows.find((r) => r.id === bird.id);
            return (
              <section key={bird.id} className={styles.spectatorLane} style={laneStyle(slot)}>
                <div className={styles.spectatorLabel}>
                  <b>{slot + 1}</b>
                  <span>{row?.name ?? ''}</span>
                  <strong>{row?.total ?? 0}</strong>
                </div>
                <Arena
                  bird={bird}
                  gates={view.gates ?? []}
                  time={t}
                  reduced={reduced}
                  label={L('Lane {n}: {state}', {
                    n: slot + 1,
                    state: bird.died !== null ? L('OUT') : L('FLYING'),
                  })}
                />
              </section>
            );
          })}
        </div>
      ) : (
        <ol className={styles.rows} aria-label={L('Players and points')}>
          {rows.map((row) => (
            <li key={row.id} style={laneStyle(row.slot)} data-me={row.me ? 'true' : undefined}>
              <span className={styles.laneNumber}>{row.slot + 1}</span>
              <b className={styles.name}>{row.name}</b>
              <span className={styles.state}>
                {playing ? (row.out ? L('OUT') : L('FLYING')) : `+${row.gained}`}
              </span>
              <strong className={styles.points}>{row.total}</strong>
            </li>
          ))}
        </ol>
      )}
      {flying ? (
        <button
          type="button"
          className={styles.flap}
          disabled={view.paused}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            flap();
          }}
          onClick={(event) => {
            if (event.detail === 0) flap();
          }}
        >
          <span className={styles.glider} aria-hidden="true">
            ↗
          </span>
          <span>{L('TAP TO FLAP')}</span>
          <small>
            {L('Round {n} of {m} · {g} gates', {
              n: view.round,
              m: view.rounds,
              g: own?.passed ?? 0,
            })}
          </small>
        </button>
      ) : player && playing ? (
        <p className={styles.wait}>
          {stage ? L('Keep watching · next round soon') : L('Watch the stage · next round soon')}
        </p>
      ) : null}
    </div>
  );
}
