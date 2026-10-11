// The personal tower stays visible above thumb-sized hold buttons; stage rooms add standings.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { usePhoneOnly, useServerNow } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { HelixControllerView } from '../server/index';
import type { Input } from '../server/types';
import { directionOf } from './controls';
import { Standings } from './Standings';
import { Tower } from './Tower';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<HelixControllerView, Input>): JSX.Element {
  const phoneOnly = usePhoneOnly() || view.phoneOnly === true;
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const lane = view.lane;
  const active =
    view.phaseId === 'play' &&
    !view.paused &&
    lane !== null &&
    lane.lives > 0 &&
    !lane.cleared &&
    !lane.recovering;
  const held = useRef({ left: false, right: false });
  const [lit, setLit] = useState(held.current);
  const press = useCallback(
    (side: 'left' | 'right', down: boolean): void => {
      if (!active || held.current[side] === down) return;
      held.current = { ...held.current, [side]: down };
      setLit(held.current);
      send({ type: 'rotate', dir: directionOf(held.current.left, held.current.right) });
    },
    [active, send],
  );
  const release = useCallback((): void => {
    const moving = held.current.left || held.current.right;
    held.current = { left: false, right: false };
    setLit(held.current);
    if (active && moving) send({ type: 'rotate', dir: 0 });
  }, [active, send]);
  // Renew while held. The server's short lease prevents stuck rotation after a lost socket.
  useEffect(() => {
    const dir = directionOf(held.current.left, held.current.right);
    if (active && dir !== 0) send({ type: 'rotate', dir });
  }, [now, active, send]);
  useEffect(() => {
    if (!active) release();
  }, [active, release]);
  useEffect(() => {
    const keys =
      (down: boolean) =>
      (event: KeyboardEvent): void => {
        const side = ['ArrowLeft', 'a', 'A'].includes(event.key)
          ? 'left'
          : ['ArrowRight', 'd', 'D'].includes(event.key)
            ? 'right'
            : null;
        if (!side) return;
        event.preventDefault();
        press(side, down);
      };
    const down = keys(true),
      up = keys(false);
    const hidden = (): void => {
      if (document.hidden) release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [press, release]);

  const over = view.phaseId !== 'play';
  const winner =
    view.winnerIds.length === 1
      ? (view.players.find((p) => p.id === view.winnerIds[0])?.name ?? 'Player')
      : null;
  const headline = over
    ? winner
      ? `${winner} wins!`
      : 'Shared victory!'
    : !lane
      ? 'Watch the dive'
      : lane.cleared
        ? 'Tower cleared!'
        : lane.lives === 0
          ? 'Your run is complete'
          : lane.recovering
            ? 'Crash — try again'
            : 'Thread the gaps';
  return (
    <div
      className={styles.screen}
      data-stage={phoneOnly || undefined}
      data-active={active || undefined}
    >
      <header>
        <h2>{headline}</h2>
        <p aria-live="polite">
          {lane
            ? `Best ${lane.best} floors · ${lane.lives} ${lane.lives === 1 ? 'life' : 'lives'}`
            : `${view.players.length} divers`}
          {lane?.chain && lane.chain >= 3 ? ' · SMASH charged' : ''}
        </p>
      </header>
      {lane ? (
        <div className={styles.tower}>
          <Tower lane={lane} />
        </div>
      ) : view.lanes ? (
        <div className={styles.spectatorTowers}>
          {view.lanes.map((l) => (
            <div key={l.id}>
              <b>{view.players.find((p) => p.id === l.id)?.name}</b>
              <Tower lane={l} />
            </div>
          ))}
        </div>
      ) : null}
      {active ? (
        <div className={styles.pads} role="group" aria-label="Rotate tower">
          {(['left', 'right'] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-label={`Hold ${side} to rotate`}
              aria-pressed={lit[side]}
              data-held={lit[side] || undefined}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                press(side, true);
              }}
              onPointerUp={() => press(side, false)}
              onPointerCancel={() => press(side, false)}
              onLostPointerCapture={() => press(side, false)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  press(side, true);
                }
              }}
              onKeyUp={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  press(side, false);
                }
              }}
              onBlur={() => press(side, false)}
            >
              <span aria-hidden="true">{side === 'left' ? '◀' : '▶'}</span>
              <b>Hold {side}</b>
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.receipt}>
          {over && lane
            ? `Place ${view.rank} · ${lane.best} floors`
            : lane?.recovering
              ? 'Fresh attempt in a moment. Best depth stays.'
              : 'The race continues for the other divers.'}
        </p>
      )}
      {phoneOnly || over || !lane ? (
        <Standings players={view.players} scores={view.scores} me={view.me.id} />
      ) : (
        <p className={styles.legend}>Open gap ↓ · Crosses × danger · 3 gaps = smash</p>
      )}
    </div>
  );
}
