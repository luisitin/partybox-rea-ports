import { useEffect, useRef } from 'react';
import type { JSX, KeyboardEvent, PointerEvent } from 'react';
import { buzz, usePhoneOnly, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { ControllerMergeView, Input } from '../server/types';
import { Board } from './Board';
import { RaceStage } from './RaceStage';
import { StandingsStrip } from './StandingsStrip';
import { clockText, ranked } from './presentation';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

const DIRECTIONS = ['left', 'up', 'down', 'right'] as const;
const ARROWS = { left: '←', up: '↑', down: '↓', right: '→' } as const;

/** The server judges all merges and spawns. The phone sends one direction per gesture. */
export function Controller({
  view,
  send,
}: GameControllerProps<ControllerMergeView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const gesture = useRef<{ id: number; x: number; y: number; key: string } | null>(null);
  const mine = view.mine;
  const playing = view.phaseId === 'play';
  const canMove = playing && !view.paused && mine?.status === 'racing' && view.me.role === 'player';
  const left = view.deadline === null ? null : Math.max(0, view.deadline - now);
  const leader = ranked(view.racers)[0];
  const names = Object.fromEntries(view.players.map((p) => [p.id, p.name]));
  const gestureKey = `${view.phaseId}:${view.phaseAt}:${view.paused}:${mine?.status}:${mine?.moves}`;
  useEffect(() => {
    gesture.current = null;
  }, [gestureKey]);

  const move = (dir: Input['dir']): void => {
    if (!canMove || !mine) return;
    send({ type: 'move', dir, move: mine.moves });
    buzz(8);
  };
  const start = (event: PointerEvent<HTMLDivElement>): void => {
    if (!canMove || !event.isPrimary || event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, key: gestureKey };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const finish = (event: PointerEvent<HTMLDivElement>): void => {
    const began = gesture.current;
    gesture.current = null;
    if (!began || began.id !== event.pointerId || began.key !== gestureKey) return;
    const dx = event.clientX - began.x;
    const dy = event.clientY - began.y;
    // Proportional to the board, so a deliberate swipe works on both small and large phones.
    if (Math.max(Math.abs(dx), Math.abs(dy)) < event.currentTarget.clientWidth / 12) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    const keys: Record<string, Input['dir']> = {
      ArrowLeft: 'left',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowRight: 'right',
    };
    const dir = keys[event.key];
    if (!dir || !canMove || event.repeat) return;
    event.preventDefault();
    move(dir);
  };

  if (!playing || !mine || view.me.role === 'spectator' || mine.status === 'blocked') {
    return <RaceStage view={view} phoneOnly={phoneOnly} />;
  }

  return (
    <div className={styles.screen} data-phone-only={phoneOnly || undefined} onKeyDown={keyboard}>
      <header className={styles.header}>
        <div>
          <h2>{L('Merge Sprint')}</h2>
          <p>{L('Race to {target}', { target: view.target })}</p>
        </div>
        <div className={styles.clock} role="timer" data-urgent={left !== null && left <= 5000}>
          <span>{view.paused ? L('Paused') : L('Time left')}</span>
          <strong>{left === null ? '—' : clockText(left)}</strong>
        </div>
      </header>
      <dl className={styles.stats}>
        <div>
          <dt>{L('Score')}</dt>
          <dd>{mine.score}</dd>
        </div>
        <div>
          <dt>{L('Best tile')}</dt>
          <dd>{mine.best}</dd>
        </div>
        <div>
          <dt>{L('Place')}</dt>
          <dd>#{mine.rank}</dd>
        </div>
      </dl>
      <div className={styles.boardSpace}>
        <div
          className={styles.swipe}
          role="group"
          aria-label={L('Your board. Swipe or use arrow keys to move tiles.')}
          tabIndex={canMove ? 0 : -1}
          onPointerDown={start}
          onPointerUp={finish}
          onPointerCancel={() => (gesture.current = null)}
          onLostPointerCapture={() => (gesture.current = null)}
        >
          <Board board={mine.board} label={L('Your board')} moves={mine.moves} />
        </div>
      </div>
      <p className={styles.hint}>
        {phoneOnly && leader
          ? L('{name} leads · best tile {tile}', {
              name: names[leader.id] ?? leader.id,
              tile: leader.best,
            })
          : L('Swipe the board or tap a direction.')}
      </p>
      {phoneOnly ? <StandingsStrip view={view} /> : null}
      <div className={styles.controls} role="group" aria-label={L('Move tiles')}>
        {DIRECTIONS.map((dir) => (
          <button
            key={dir}
            type="button"
            className={styles.direction}
            disabled={!canMove}
            onClick={() => move(dir)}
            aria-label={
              dir === 'left'
                ? L('Move left')
                : dir === 'up'
                  ? L('Move up')
                  : dir === 'down'
                    ? L('Move down')
                    : L('Move right')
            }
          >
            <span aria-hidden="true">{ARROWS[dir]}</span>
          </button>
        ))}
      </div>
      <p className={styles.rule}>
        {view.paused
          ? L('Race paused. Controls resume with the clock.')
          : L('Equal tiles merge once per move.')}
      </p>
    </div>
  );
}
