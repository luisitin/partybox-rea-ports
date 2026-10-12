// A phone sends a direction, never a position. Capture and every exit path release steering.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, PointerEvent } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { Input } from '../server/types';
import { editableKeyTarget, padVector, SteeringSession, STOP } from './controls';
import type { Vector } from './controls';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Joystick({
  active,
  canSplit,
  reason,
  contextKey,
  send,
}: {
  active: boolean;
  canSplit: boolean;
  reason: string;
  contextKey: string;
  send: (input: Input) => void;
}): JSX.Element {
  const L = useT(STRINGS);
  const pad = useRef<HTMLButtonElement>(null);
  const sendCurrent = useRef(send);
  sendCurrent.current = send;
  const splitReady = useRef(canSplit);
  splitReady.current = canSplit;
  const [shown, setShown] = useState<Vector>(STOP);
  const session = useRef<SteeringSession | null>(null);
  if (session.current === null)
    session.current = new SteeringSession((input) => sendCurrent.current(input), setShown);
  const controls = session.current;
  const currentContext = useRef({ contextKey, active });
  currentContext.current = { contextKey, active };
  const releaseCapture = useCallback((id: number | null): void => {
    if (id !== null && pad.current?.hasPointerCapture(id)) pad.current.releasePointerCapture(id);
  }, []);
  const reset = useCallback((): void => {
    releaseCapture(controls.reset());
  }, [controls, releaseCapture]);
  const synchronize = useCallback((): void => {
    releaseCapture(
      controls.setContext(currentContext.current.contextKey, currentContext.current.active),
    );
  }, [controls, releaseCapture]);
  const aim = (event: PointerEvent<HTMLButtonElement>): Vector => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const reach =
      Number.parseFloat(getComputedStyle(event.currentTarget).getPropertyValue('--pb-touch')) || 44;
    return padVector(
      event.clientX - bounds.left - bounds.width / 2,
      event.clientY - bounds.top - bounds.height / 2,
      reach,
    );
  };
  useEffect(() => {
    synchronize();
    if (!active) return;
    const keyEvent =
      (down: boolean) =>
      (event: KeyboardEvent): void => {
        synchronize();
        const editable = event.target instanceof HTMLElement && editableKeyTarget(event.target);
        if (controls.key(event, down, editable, splitReady.current) && !editable)
          event.preventDefault();
      };
    const down = keyEvent(true),
      up = keyEvent(false);
    const hidden = (): void => {
      if (document.hidden) reset();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    window.addEventListener('pagehide', reset);
    window.addEventListener('offline', reset);
    window.addEventListener('online', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
      window.removeEventListener('pagehide', reset);
      window.removeEventListener('offline', reset);
      window.removeEventListener('online', reset);
      document.removeEventListener('visibilitychange', hidden);
      reset();
    };
  }, [active, contextKey, controls, reset, synchronize]);
  const thumb: CSSProperties = {
    ['--stick-x' as string]: shown.x,
    ['--stick-y' as string]: shown.y,
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    synchronize();
    if (controls.pointerUp(event.pointerId)) releaseCapture(event.pointerId);
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
          synchronize();
          if (!active || event.button !== 0 || !controls.pointerDown(event.pointerId, aim(event)))
            return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          synchronize();
          controls.pointerMove(event.pointerId, aim(event));
        }}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onLostPointerCapture={pointerUp}
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
          onPointerDown={(event) => {
            if (!active || !canSplit || event.button !== 0) return;
            event.preventDefault();
            send({ type: 'split' });
          }}
          onClick={(event) => {
            if (event.detail === 0 && active && canSplit) send({ type: 'split' });
          }}
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
