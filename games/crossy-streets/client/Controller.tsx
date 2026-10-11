// Four cardinal taps; reconnect reads the server's current racer, never a local replay.
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { buzz, usePhoneOnly, useSecondsLeft, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { CrossyControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Board, playerStyle } from './Board';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

const DIRECTIONS = [
  { dir: 'up', glyph: '↑', label: 'Hop forward' },
  { dir: 'left', glyph: '←', label: 'Hop left' },
  { dir: 'down', glyph: '↓', label: 'Hop back' },
  { dir: 'right', glyph: '→', label: 'Hop right' },
] as const;
const DEATH = {
  car: 'Traffic hit you',
  water: 'You missed the log',
  edge: 'The log carried you off',
  eagle: 'The eagle caught you',
} as const;

export function Controller({
  view,
  send,
}: GameControllerProps<CrossyControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const play = useSound();
  const seconds = useSecondsLeft(view.deadline, view.paused, 250, view.clockHeldAt);
  const own = view.own;
  const stage =
    phoneOnly || view.phoneStage || view.me.role === 'spectator' || view.phaseId === 'play';
  const playing = view.phaseId === 'play';
  const enabled = playing && own?.alive === true && !view.paused && view.me.role === 'player';
  const latest = useRef({ enabled, send });
  latest.current = { enabled, send };
  const deathCount = useRef(own?.deaths ?? 0);
  useEffect(() => {
    if (own && own.deaths > deathCount.current) {
      buzz([40, 60, 40]);
      play('wrong');
    }
    deathCount.current = own?.deaths ?? 0;
  }, [own, play]);
  useEffect(() => {
    const keys: Record<string, Input['dir']> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
    };
    const hop = (event: KeyboardEvent): void => {
      const dir = keys[event.key];
      if (
        !dir ||
        !latest.current.enabled ||
        event.repeat ||
        event.target instanceof HTMLButtonElement
      )
        return;
      event.preventDefault();
      latest.current.send({ type: 'hop', dir });
    };
    window.addEventListener('keydown', hop);
    return () => window.removeEventListener('keydown', hop);
  }, []);
  const eagleDue = own ? Math.max(own.lastProgressAt + 8000, own.protectedUntil) : 8000;
  const idle = Math.max(0, Math.ceil((eagleDue - view.checked) / 1000));
  const warning = enabled && idle <= 3;
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const order = [...view.runners].sort((a, b) => b.maxRow - a.maxRow || a.slot - b.slot);
  const best = order[0]?.maxRow ?? 0;
  const winners = order.filter((r) => r.maxRow === best);
  const winner =
    winners.length === 1
      ? L('{name} went furthest!', { name: names.get(winners[0]!.id) ?? '' })
      : L('A tie at the top!');
  return (
    <section
      className={styles.screen}
      style={playerStyle(own?.slot ?? 0)}
      data-stage={stage || undefined}
    >
      <header className={styles.header}>
        <div>
          <h2>
            {playing
              ? own
                ? L('Racer {n}', { n: own.slot + 1 })
                : L('Watching the race')
              : winner}
          </h2>
          <p>
            {playing
              ? L('Best: {n} rows', { n: own?.maxRow ?? best })
              : own
                ? L('Your best: {n} rows', { n: own.maxRow })
                : L('Final distances')}
          </p>
        </div>
        {playing ? (
          <b className={styles.clock} role="timer" aria-label={L('Seconds left')}>
            {seconds ?? view.seconds}s
          </b>
        ) : null}
      </header>
      {stage ? (
        <div className={styles.map}>
          <Board map={view.map} runners={view.runners} focus={own} />
        </div>
      ) : (
        <div className={styles.identity}>
          <b>{own ? own.slot + 1 : '◎'}</b>
          <p>{L('Find your numbered racer')}</p>
        </div>
      )}
      {playing && own ? (
        <div
          className={styles.feedback}
          role="status"
          aria-live="polite"
          data-warning={warning || undefined}
        >
          {!own.alive ? (
            <>
              <b>{L(DEATH[own.lastDeath ?? 'car'])}</b>
              <span>{L('Returning… Your best stays.')}</span>
            </>
          ) : warning ? (
            <>
              <b>{L('Eagle in {n}s!', { n: idle })}</b>
              <span>{L('Reach a new best row to escape.')}</span>
            </>
          ) : (
            <>
              <b>{L('Hop ahead. Ride the logs.')}</b>
              <span>{L('Crashes cost time, never your best.')}</span>
            </>
          )}
        </div>
      ) : null}
      {playing && own ? (
        <div className={styles.pad} role="group" aria-label={L('Hopping controls')}>
          {DIRECTIONS.map(({ dir, glyph, label }) => (
            <button
              key={dir}
              type="button"
              className={styles[dir]}
              disabled={!enabled}
              aria-label={L(label)}
              onClick={() => {
                buzz(10);
                send({ type: 'hop', dir });
              }}
            >
              <span aria-hidden="true">{glyph}</span>
              <small>
                {L(
                  dir === 'up'
                    ? 'FORWARD'
                    : dir === 'down'
                      ? 'BACK'
                      : dir === 'left'
                        ? 'LEFT'
                        : 'RIGHT',
                )}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <ol className={styles.standings} aria-label={L('Final distances')}>
          {order.map((runner) => (
            <li
              key={runner.id}
              style={playerStyle(runner.slot)}
              data-me={runner.id === view.me.id || undefined}
            >
              <b className={styles.badge}>{runner.slot + 1}</b>
              <span>{names.get(runner.id)}</span>
              <strong>{runner.maxRow}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
