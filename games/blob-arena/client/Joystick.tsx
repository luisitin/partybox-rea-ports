// A phone sends a direction, never a position. Capture and every exit path release steering.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, PointerEvent } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { Input } from '../server/types';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

interface Vector {
  x: number;
  y: number;
}
const STOP: Vector = { x: 0, y: 0 };
const keyDirection = (key: string): 'up' | 'down' | 'left' | 'right' | null => {
  const lower = key.toLowerCase();
  if (lower === 'arrowup' || lower === 'w') return 'up';
  if (lower === 'arrowdown' || lower === 's') return 'down';
  if (lower === 'arrowleft' || lower === 'a') return 'left';
  if (lower === 'arrowright' || lower === 'd') return 'right';
  return null;
};
const normalized = (x: number, y: number): Vector => {
  const length = Math.max(1, Math.hypot(x, y));
  return { x: Math.round((x / length) * 100) / 100, y: Math.round((y / length) * 100) / 100 };
};

export function Joystick({
  active,
  canSplit,
  reason,
  roundKey,
  send,
}: {
  active: boolean;
  canSplit: boolean;
  reason: string;
  roundKey: string;
  send: (input: Input) => void;
}): JSX.Element {
  const L = useT(STRINGS);
  const pointer = useRef<number | null>(null);
  const pad = useRef<HTMLButtonElement>(null);
  const keys = useRef(new Set<string>());
  const sent = useRef<Vector>(STOP);
  const sendCurrent = useRef(send);
  sendCurrent.current = send;
  const splitReady = useRef(canSplit);
  splitReady.current = canSplit;
  const [shown, setShown] = useState<Vector>(STOP);
  const publish = useCallback((vector: Vector): void => {
    setShown(vector);
    if (vector.x === sent.current.x && vector.y === sent.current.y) return;
    sent.current = vector;
    sendCurrent.current({ type: 'steer', ...vector });
  }, []);
  const release = useCallback((): void => {
    const id = pointer.current;
    pointer.current = null;
    keys.current.clear();
    if (id !== null && pad.current?.hasPointerCapture(id)) pad.current.releasePointerCapture(id);
    publish(STOP);
  }, [publish]);
  const aim = (event: PointerEvent<HTMLButtonElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const reach = Math.max(1, Math.min(bounds.width, bounds.height) * 0.35);
    const x = (event.clientX - bounds.left - bounds.width / 2) / reach;
    const y = (event.clientY - bounds.top - bounds.height / 2) / reach;
    publish(Math.hypot(x, y) < 0.12 ? STOP : normalized(x, y));
  };
  useEffect(() => {
    release();
    if (!active) return;
    const keyEvent =
      (down: boolean) =>
      (event: KeyboardEvent): void => {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
        )
          return;
        const direction = keyDirection(event.key);
        if (direction) {
          event.preventDefault();
          if (down) keys.current.add(event.key.toLowerCase());
          else keys.current.delete(event.key.toLowerCase());
          if (pointer.current !== null) return;
          const held = [...keys.current].map(keyDirection);
          publish(
            normalized(
              Number(held.includes('right')) - Number(held.includes('left')),
              Number(held.includes('down')) - Number(held.includes('up')),
            ),
          );
        } else if (event.code === 'Space' || event.key.toLowerCase() === 'e') {
          event.preventDefault();
          if (down && !event.repeat && splitReady.current) sendCurrent.current({ type: 'split' });
        }
      };
    const down = keyEvent(true);
    const up = keyEvent(false);
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
      release();
    };
    // Split readiness changes often; the pad must keep capture while it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, roundKey, publish, release]);
  const thumb: CSSProperties = {
    ['--stick-x' as string]: shown.x,
    ['--stick-y' as string]: shown.y,
  };
  return (
    <div className={styles.controls}>
      <button
        ref={pad}
        type="button"
        className={styles.pad}
        data-pad-primary="true"
        disabled={!active}
        aria-label={L('Steering pad. Drag or use arrow keys or W A S D.')}
        onPointerDown={(event) => {
          if (!active || pointer.current !== null || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          aim(event);
        }}
        onPointerMove={(event) => {
          if (event.pointerId === pointer.current) aim(event);
        }}
        onPointerUp={(event) => {
          if (event.pointerId === pointer.current) release();
        }}
        onPointerCancel={(event) => {
          if (event.pointerId === pointer.current) release();
        }}
        onLostPointerCapture={(event) => {
          if (event.pointerId === pointer.current) release();
        }}
      >
        <span className={styles.padArrows} aria-hidden="true">
          ↕<br />↔
        </span>
        <span className={styles.thumb} style={thumb} aria-hidden="true" />
        <span className={styles.padLabel}>{L('Drag to steer')}</span>
      </button>
      <div className={styles.splitArea}>
        <button
          type="button"
          className={styles.split}
          disabled={!active || !canSplit}
          onClick={() => send({ type: 'split' })}
          aria-describedby="blob-split-reason"
        >
          <span aria-hidden="true">↗</span> {L('SPLIT')}
        </button>
        <p id="blob-split-reason" className={styles.reason} aria-live="polite">
          {L.sent(reason)}
        </p>
        <p className={styles.risk}>{L('Hold steer + tap. Smaller halves are vulnerable.')}</p>
      </div>
    </div>
  );
}
