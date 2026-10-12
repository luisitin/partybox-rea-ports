import { useEffect, useRef, useState } from 'react';
import type { JSX, KeyboardEvent, PointerEvent } from 'react';
import { MOTION_BASE, buzz, usePhoneOnly, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { ControllerMergeView, Input } from '../server/types';
import { TERMINAL_PAYOFF_MS } from '../server/types';
import { Board } from './Board';
import { RaceStage } from './RaceStage';
import { StandingsStrip } from './StandingsStrip';
import { clockText, ranked } from './presentation';
import { STRINGS } from './strings';
import styles from './Controller.module.css';
import { MOVE_CONFIRM_MS, initialFeedback, observeMove, reserveMove } from './move-feedback';

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
  const [personalBest, setPersonalBest] = useState(mine?.score ?? 0);
  useEffect(() => {
    // Original BEST is a score record, not the largest tile. Storage is optional:
    // a restricted browser still keeps the current race score visible.
    const storageKey = `partybox:2048:best:${view.me.id}`;
    let saved = 0;
    try {
      const candidate = Number(localStorage.getItem(storageKey));
      saved = Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : 0;
    } catch {
      /* private/restricted storage does not affect the authoritative game */
    }
    const best = Math.max(saved, mine?.score ?? 0);
    setPersonalBest(best);
    try {
      localStorage.setItem(storageKey, String(best));
    } catch {
      /* record persistence is optional */
    }
  }, [view.me.id, mine?.score]);
  const animationInput = useRef<{ key: string; moves: number; dir: Input['dir'] } | null>(null);
  const playing = view.phaseId === 'play';
  const terminalPayoff =
    view.phaseId === 'reveal' &&
    ((view.reason === 'target' && mine?.status === 'finished') ||
      (view.reason === 'blocked' && mine?.status === 'blocked')) &&
    view.me.role === 'player' &&
    now < (view.terminalPayoffUntil ?? view.phaseAt + TERMINAL_PAYOFF_MS);
  const winningPayoff = terminalPayoff && view.reason === 'target';
  const lastPlayAt = useRef(playing ? view.phaseAt : null);
  useEffect(() => {
    if (playing) lastPlayAt.current = view.phaseAt;
  }, [playing, view.phaseAt]);
  const connected = view.players.find((p) => p.id === view.me.id)?.connected !== false;
  const canMove =
    playing && connected && !view.paused && mine?.status === 'racing' && view.me.role === 'player';
  const left = view.deadline === null ? null : Math.max(0, view.deadline - now);
  const leader = ranked(view.racers)[0];
  const names = Object.fromEntries(view.players.map((p) => [p.id, p.name]));
  const leaderAway = view.players.find((p) => p.id === leader?.id)?.connected === false;
  const feedbackView = {
    key:
      terminalPayoff && lastPlayAt.current !== null
        ? `play:${lastPlayAt.current}:${view.me.id}`
        : `${view.phaseId}:${view.phaseAt}:${view.me.id}`,
    moves: mine?.moves ?? 0,
    score: mine?.score ?? 0,
    active: canMove,
  };
  const feedbackRef = useRef(initialFeedback(feedbackView));
  const [feedback, setFeedback] = useState(feedbackRef.current);
  const observe = (): void => {
    const receipt = observeMove(feedbackRef.current, feedbackView, Date.now());
    feedbackRef.current = receipt.state;
    setFeedback(receipt.state);
    if (receipt.accepted && (playing || terminalPayoff) && !view.paused)
      buzz(receipt.state.gain > 0 ? [20, 30, 20] : 8);
  };
  useEffect(observe, [feedbackView.key, feedbackView.moves, feedbackView.score, canMove]);
  useEffect(() => {
    const at =
      feedback.pendingAt === null ? feedback.readyAt : feedback.pendingAt + MOVE_CONFIRM_MS;
    const wait = at - Date.now();
    if (wait <= 0) {
      observe();
      return;
    }
    const handle = setTimeout(() => {
      const latest = feedbackRef.current;
      if (
        latest.key === feedback.key &&
        latest.moves === feedback.moves &&
        latest.pendingAt === feedback.pendingAt &&
        latest.readyAt === feedback.readyAt
      )
        observe();
    }, wait);
    return () => clearTimeout(handle);
  }, [feedback.key, feedback.pendingAt, feedback.readyAt, canMove]);
  const ready = canMove && feedback.pendingAt === null && Date.now() >= feedback.readyAt;
  const gestureKey = `${view.phaseId}:${view.phaseAt}:${view.paused}:${mine?.status}:${mine?.moves}`;
  useEffect(() => {
    gesture.current = null;
  }, [gestureKey]);

  const move = (dir: Input['dir']): void => {
    if (!canMove || !mine) return;
    observe();
    const current = feedbackRef.current;
    const pending = reserveMove(current, feedbackView, mine.board, dir, Date.now());
    if (!pending) return;
    feedbackRef.current = pending;
    setFeedback(pending);
    animationInput.current = { key: feedbackView.key, moves: current.moves, dir };
    send({ type: 'move', dir, move: current.moves });
  };
  const start = (event: PointerEvent<HTMLDivElement>): void => {
    if (!ready || !event.isPrimary || event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, key: gestureKey };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const finish = (event: PointerEvent<HTMLDivElement>): void => {
    const began = gesture.current;
    gesture.current = null;
    if (!began || began.id !== event.pointerId || began.key !== gestureKey) return;
    const dx = event.clientX - began.x;
    const dy = event.clientY - began.y;
    // Match the original's deliberate >10px dominant-axis swipe threshold.
    if (Math.max(Math.abs(dx), Math.abs(dy)) <= 10) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const keys: Record<string, Input['dir']> = {
      ArrowLeft: 'left',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowRight: 'right',
      a: 'left',
      A: 'left',
      w: 'up',
      W: 'up',
      s: 'down',
      S: 'down',
      d: 'right',
      D: 'right',
      h: 'left',
      H: 'left',
      k: 'up',
      K: 'up',
      j: 'down',
      J: 'down',
      l: 'right',
      L: 'right',
    };
    const dir = keys[event.key];
    if (!dir || !canMove) return;
    event.preventDefault();
    move(dir);
  };

  if ((!playing && !terminalPayoff) || !mine || view.me.role === 'spectator') {
    return <RaceStage view={view} phoneOnly={phoneOnly} />;
  }

  return (
    <div className={styles.screen} data-phone-only={phoneOnly || undefined} onKeyDown={keyboard}>
      <header className={styles.header}>
        <h2>{L('2048')}</h2>
        <dl className={styles.stats}>
          <div>
            <dt>{L('Score')}</dt>
            <dd>
              {mine.score}
              <span className={styles.gain} role="status" key={`${feedback.key}:${feedback.moves}`}>
                {feedback.gain > 0 ? `+${feedback.gain}` : null}
              </span>
            </dd>
          </div>
          <div>
            <dt>{L('Best')}</dt>
            <dd>{Math.max(personalBest, mine.score)}</dd>
          </div>
        </dl>
      </header>
      <div className={styles.intro}>
        <p>{L('Join the numbers and get to the {target} tile!', { target: view.target })}</p>
        <span className={styles.clock} role="timer" data-urgent={left !== null && left <= 5000}>
          {terminalPayoff ? L('Race complete') : view.paused ? L('Paused') : L('Time left')}{' '}
          <strong>{terminalPayoff || left === null ? '—' : clockText(left)}</strong>
        </span>
        <div className={styles.raceInfo}>
          <span>
            {L('Best tile')} {mine.best} · {L('Place')} #{mine.rank}
          </span>
        </div>
      </div>
      <div className={styles.boardSpace}>
        <div
          className={styles.swipe}
          role="group"
          aria-label={L('Your board. Swipe or use arrow keys to move tiles.')}
          tabIndex={ready ? 0 : -1}
          aria-busy={feedback.pendingAt !== null}
          onPointerDown={start}
          onPointerUp={finish}
          onPointerCancel={() => (gesture.current = null)}
          onLostPointerCapture={() => (gesture.current = null)}
        >
          <Board
            board={mine.board}
            label={L('Your board')}
            moves={mine.moves}
            animateInitial={
              playing &&
              mine.moves === 0 &&
              now - view.phaseAt >= 0 &&
              now - view.phaseAt < MOTION_BASE
            }
            direction={
              animationInput.current?.key === feedbackView.key &&
              animationInput.current.moves + 1 === mine.moves
                ? animationInput.current.dir
                : undefined
            }
          />
          {mine.status === 'blocked' || terminalPayoff ? (
            <div className={styles.overlay} role="status">
              <strong>{winningPayoff ? L('You win!') : L('Game over!')}</strong>
              <span>
                {winningPayoff
                  ? L('{target} reached!', { target: view.target })
                  : L('No moves left')}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <p className={styles.hint}>
        {terminalPayoff && winningPayoff
          ? L('You won! · {score} points', { score: mine.score })
          : mine.status === 'blocked'
            ? L('Your {score} points stay in the race.', { score: mine.score })
            : phoneOnly && leader
              ? L('{name} leads · best tile {tile}', {
                  name: `${names[leader.id] ?? leader.id}${leader.bot ? ` (${L('Bot')})` : leaderAway ? ` (${L('Away')})` : ''}`,
                  tile: leader.best,
                })
              : L('Swipe the board or tap a direction.')}
      </p>
      {phoneOnly ? <StandingsStrip view={view} /> : null}
      {mine.status !== 'blocked' && !terminalPayoff ? (
        <div className={styles.controls} role="group" aria-label={L('Move tiles')}>
          {DIRECTIONS.map((dir) => (
            <button
              key={dir}
              type="button"
              className={styles.direction}
              // Retain native keyboard focus while an accepted move settles. The
              // guarded move handler rejects busy/paused clicks and key presses.
              aria-disabled={!ready}
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
      ) : null}
      <p className={styles.rule}>
        {terminalPayoff
          ? L('Final standings follow.')
          : feedback.failed
            ? L('Move not confirmed. Try again.')
            : view.paused
              ? L('Race paused. Controls resume with the clock.')
              : phoneOnly
                ? L('First to {target} wins. At the buzzer, highest score wins.', {
                    target: view.target,
                  })
                : L('Equal tiles merge once per move.')}
      </p>
    </div>
  );
}
