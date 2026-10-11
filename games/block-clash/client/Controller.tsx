// Thumb controls and optional gestures share schema-valid inputs; a refresh reads the server's board.
import { useEffect, useRef } from 'react';
import type { JSX, PointerEvent } from 'react';
import { buzz, usePhoneOnly, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { BlockClashControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Board } from './Board';
import { Preview } from './Preview';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<BlockClashControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const play = useSound();
  const seconds = Math.max(0, Math.ceil(((view.deadline ?? now) - now) / 1000));
  const mine = view.board;
  const active =
    view.phaseId === 'play' && view.me.role === 'player' && mine?.alive && !view.paused;
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const previousLines = useRef(mine?.lines ?? 0);
  useEffect(() => {
    if ((mine?.lines ?? 0) > previousLines.current) {
      play('correct');
      buzz(30);
    }
    previousLines.current = mine?.lines ?? 0;
  }, [mine?.lines, play]);
  const act = (input: Input): void => {
    if (!active) return;
    send(input);
    buzz(8);
  };
  const ended = view.phaseId !== 'play';
  const leader = view.standings.filter((p) => p.rank === 1);
  const target = view.boards.find((p) => p.id === mine?.target);
  const mineStanding = view.standings.find((p) => p.id === view.me.id);
  const endGesture = (event: PointerEvent<HTMLDivElement>): void => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || !active) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= 24)
      act({ type: 'move', direction: dx < 0 ? 'left' : 'right' });
    else if (dy >= 24) act({ type: 'move', direction: 'down' });
    else if (dy <= -24) act({ type: 'rotate', direction: 'ccw' });
    else act({ type: 'rotate', direction: 'cw' });
  };
  const standings = (
    <ol className={styles.standings} aria-label={L('Match standings')}>
      {view.standings.map((p) => (
        <li key={p.id} data-me={p.id === view.me.id}>
          <b>
            {p.rank}. {p.name}
          </b>
          <span>
            {p.score} {L('pts')}
          </span>
          <small>{p.alive ? '●' : L('OUT')}</small>
        </li>
      ))}
    </ol>
  );
  if (ended || !mine || !mine.alive) {
    return (
      <div className={styles.stage}>
        <header>
          <h2>{ended ? L('Match complete') : mine ? L('You are out') : L('Watching the match')}</h2>
          <p>
            {ended
              ? leader.length === 1
                ? `${leader[0]?.name} wins!`
                : L('A tie at the top!')
              : `${view.boards.filter((p) => p.alive).length} ${L('still playing')} · ${seconds}s`}
          </p>
          {mineStanding && ended && (
            <p>
              {L('Your place')}: {mineStanding.rank} · {mineStanding.lines} {L('lines cleared')}
            </p>
          )}
        </header>
        {(!ended || phoneOnly) && (
          <div className={styles.match} aria-label={L('The match stage')}>
            {view.boards.map((p) => (
              <figure key={p.id}>
                <figcaption>{p.name}</figcaption>
                <Board board={p} />
              </figure>
            ))}
          </div>
        )}
        {standings}
      </div>
    );
  }
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h2>
          {mine.score} {L('pts')}{' '}
          <span>
            · {mine.lines} {L('lines')}
          </span>
        </h2>
        <b role="timer" aria-label={L('Time left')}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </b>
        <p role="status">
          {mine.pending
            ? `${mine.pending} ${L('rows incoming — clear lines to cancel!')}`
            : L('Clear 2+ lines to send rows.')}
        </p>
      </header>
      <div className={styles.boardZone}>
        <div
          className={styles.picture}
          role="group"
          aria-label={L('Swipe to move, tap to rotate')}
          onPointerDown={(event) => {
            if (!active) return;
            gesture.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={endGesture}
          onPointerCancel={() => {
            gesture.current = null;
          }}
        >
          <Board board={mine} />
        </div>
        <aside className={styles.next}>
          <b>{L('Next')}</b>
          {view.next.slice(0, 3).map((kind, i) => (
            <Preview kind={kind} key={i} />
          ))}
          <b>{L('Hold')}</b>
          <Preview kind={view.hold} />
          {phoneOnly && (
            <p>
              {L('Place')} {mineStanding?.rank}
              <br />
              {view.boards.filter((p) => p.alive).length} {L('playing')}
            </p>
          )}
        </aside>
      </div>
      <label className={styles.target}>
        {L('Send rows to')}
        <select
          value={mine.target ?? ''}
          disabled={!active}
          aria-label={L('Choose rival')}
          onChange={(event) => act({ type: 'target', playerId: event.target.value })}
        >
          {!target && <option value="">{L('No rival')}</option>}
          {view.boards
            .filter((p) => p.alive && p.id !== view.me.id)
            .map((p) => (
              <option value={p.id} key={p.id}>
                {p.name} · {p.score} {L('pts')}
              </option>
            ))}
        </select>
      </label>
      <div className={styles.controls} role="group" aria-label={L('Block controls')}>
        <button
          disabled={!active}
          onClick={() => act({ type: 'move', direction: 'left' })}
          aria-label={L('Move left')}
        >
          ←
        </button>
        <button
          disabled={!active}
          onClick={() => act({ type: 'rotate', direction: 'cw' })}
          aria-label={L('Rotate clockwise')}
        >
          ↻ {L('Turn')}
        </button>
        <button
          disabled={!active}
          onClick={() => act({ type: 'move', direction: 'right' })}
          aria-label={L('Move right')}
        >
          →
        </button>
        <button disabled={!active || !view.canHold} onClick={() => act({ type: 'hold' })}>
          {L('Hold')}
        </button>
        <button
          disabled={!active}
          onClick={() => act({ type: 'move', direction: 'down' })}
          aria-label={L('Soft drop')}
        >
          ↓ {L('Down')}
        </button>
        <button className={styles.drop} disabled={!active} onClick={() => act({ type: 'drop' })}>
          {L('Drop')}
        </button>
      </div>
      <p className={styles.hint}>{L('Outline = landing. Tap Drop to lock there.')}</p>
    </div>
  );
}
