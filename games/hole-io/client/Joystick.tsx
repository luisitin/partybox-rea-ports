// Event-driven joystick. A release, cancelled gesture, blur or hidden tab always sends stop.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, JSX, PointerEvent } from 'react';
import { buzz, useT } from '@partybox/game-sdk/ui';
import type { Input } from '../server/types';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

const ZERO = { x: 0, y: 0 };
const AXES: Readonly<Record<string, { x: number; y: number }>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
};

export function Joystick({
  send,
  disabled,
  status,
}: {
  send: (input: Input) => void;
  disabled: boolean;
  status: string;
}): JSX.Element {
  const L = useT(STRINGS);
  const hintId = useId();
  const [position, setPosition] = useState(ZERO);
  const pointer = useRef<number | null>(null);
  const keys = useRef(new Set<string>());
  const last = useRef(ZERO);
  const emit = useCallback(
    (x: number, y: number, force = false): void => {
      const length = Math.max(1, Math.hypot(x, y));
      const next = {
        x: Math.round((x / length) * 100) / 100,
        y: Math.round((y / length) * 100) / 100,
      };
      if (!force && next.x === last.current.x && next.y === last.current.y) return;
      last.current = next;
      setPosition(next);
      send({ type: 'move', ...next });
    },
    [send],
  );
  const stop = useCallback((): void => {
    pointer.current = null;
    keys.current.clear();
    emit(0, 0, true);
  }, [emit]);

  useEffect(() => {
    // A newly opened controller must not inherit a direction sent before the refresh.
    stop();
    const blur = (): void => stop();
    const visibility = (): void => {
      if (document.hidden) stop();
    };
    const key =
      (down: boolean) =>
      (event: KeyboardEvent): void => {
        const name = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (
          disabled ||
          !Object.hasOwn(AXES, name) ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        event.preventDefault();
        if (down) keys.current.add(name);
        else keys.current.delete(name);
        let x = 0,
          y = 0;
        for (const held of keys.current) {
          x += AXES[held]!.x;
          y += AXES[held]!.y;
        }
        emit(x, y);
      };
    const down = key(true),
      up = key(false);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      stop();
    };
  }, [disabled, emit, stop]);

  const point = (event: PointerEvent<HTMLButtonElement>): void => {
    if (disabled || pointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.32;
    if (radius <= 0) return;
    emit(
      (event.clientX - rect.left - rect.width / 2) / radius,
      (event.clientY - rect.top - rect.height / 2) / radius,
    );
  };
  const release = (event: PointerEvent<HTMLButtonElement>): void => {
    if (pointer.current !== event.pointerId) return;
    stop();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const style: CSSProperties = {
    ['--pb-joy-x' as string]: disabled ? 0 : position.x,
    ['--pb-joy-y' as string]: disabled ? 0 : position.y,
  };
  return (
    <div className={styles.control}>
      <button
        type="button"
        className={styles.pad}
        style={style}
        disabled={disabled}
        aria-label={L('Move your hole')}
        aria-describedby={hintId}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        data-moving={(!disabled && (position.x !== 0 || position.y !== 0)) || undefined}
        onPointerDown={(event) => {
          if (disabled || pointer.current !== null) return;
          pointer.current = event.pointerId;
          keys.current.clear();
          event.currentTarget.setPointerCapture(event.pointerId);
          buzz(8);
          point(event);
        }}
        onPointerMove={point}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={(event) => {
          if (pointer.current === event.pointerId) stop();
        }}
        onBlur={stop}
      >
        <span className={styles.padRing} aria-hidden="true" />
        <span className={styles.north} aria-hidden="true">
          ↑
        </span>
        <span className={styles.east} aria-hidden="true">
          →
        </span>
        <span className={styles.south} aria-hidden="true">
          ↓
        </span>
        <span className={styles.west} aria-hidden="true">
          ←
        </span>
        <span className={styles.thumb} aria-hidden="true">
          <span />
        </span>
        {disabled ? <span className={styles.padStatus}>{status}</span> : null}
      </button>
      <p className={styles.padHint} id={hintId}>
        {disabled ? status : L('Drag to steer · Release to stop · Arrow keys work too')}
      </p>
    </div>
  );
}
