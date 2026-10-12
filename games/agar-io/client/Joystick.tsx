// The floating joystick sends a direction, never a position or predicted game state.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  overlay = false,
}: {
  active: boolean;
  canSplit: boolean;
  reason: string;
  contextKey: string;
  send: (input: Input) => void;
  overlay?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  const pad = useRef<HTMLButtonElement>(null);
  const anchor = useRef<{ id: number; x: number; y: number; reach: number } | null>(null);
  const splitReady = useRef(canSplit);
  const [shown, setShown] = useState<Vector>(STOP);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  // Preserve the owner repair: one session, latest committed sender/readiness,
  // and a closure-based context rather than reading mutable refs in render.
  const [controls] = useState(() => new SteeringSession(send, setShown));
  const releaseCapture = useCallback((id: number | null): void => {
    if (id !== null && anchor.current?.id === id) {
      anchor.current = null;
      setOrigin(null);
    }
    if (id !== null && pad.current?.hasPointerCapture(id)) pad.current.releasePointerCapture(id);
  }, []);
  const reset = useCallback((): void => {
    releaseCapture(controls.reset());
    anchor.current = null;
    setOrigin(null);
  }, [controls, releaseCapture]);
  const synchronize = useCallback((): void => {
    releaseCapture(controls.setContext(contextKey, active));
  }, [controls, releaseCapture, contextKey, active]);
  useLayoutEffect(() => {
    controls.setSender(send);
    splitReady.current = canSplit;
    synchronize();
  }, [controls, send, canSplit, synchronize]);
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
  }, [active, contextKey, reset, synchronize, controls]);
  const pointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    synchronize();
    if (controls.pointerUp(event.pointerId)) releaseCapture(event.pointerId);
  };
  const thumb: CSSProperties = {
    ['--stick-x' as string]: shown.x,
    ['--stick-y' as string]: shown.y,
    ['--stick-left' as string]: `${origin?.x ?? 0}px`,
    ['--stick-top' as string]: `${origin?.y ?? 0}px`,
  };
  return (
    <div className={styles.controls} data-controls-overlay={overlay ? 'true' : undefined}>
      <button
        ref={pad}
        type="button"
        className={styles.pad}
        data-pad-primary="true"
        data-floating-joystick="true"
        disabled={!active}
        aria-label={L('Steering pad. Drag or use arrow keys or W A S D.')}
        onPointerDown={(event) => {
          synchronize();
          if (!active || event.button !== 0 || !controls.pointerDown(event.pointerId, STOP)) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const reach =
            Number.parseFloat(
              getComputedStyle(event.currentTarget).getPropertyValue('--pb-touch'),
            ) || 44;
          anchor.current = { id: event.pointerId, x: event.clientX, y: event.clientY, reach };
          // The visual ring remains within the field even when a drag starts at its edge.
          setOrigin({
            x: Math.max(reach, Math.min(bounds.width - reach, event.clientX - bounds.left)),
            y: Math.max(reach, Math.min(bounds.height - reach, event.clientY - bounds.top)),
          });
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          synchronize();
          const start = anchor.current;
          if (!start || start.id !== event.pointerId) return;
          controls.pointerMove(
            event.pointerId,
            padVector(event.clientX - start.x, event.clientY - start.y, start.reach),
          );
        }}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onLostPointerCapture={pointerUp}
      >
        {origin ? (
          <span className={styles.stick} style={thumb} aria-hidden="true">
            <span className={styles.thumb} />
          </span>
        ) : null}
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
          aria-label={L('Split')}
          aria-describedby="blob-split-reason"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" data-split-glyph="true">
            <circle cx="11" cy="24" r="8" />
            <path d="M24 8V40" />
            <circle cx="37" cy="24" r="8" />
          </svg>
          <span>{L('SPLIT')}</span>
        </button>
        <p id="blob-split-reason" className={styles.reason} aria-live="polite">
          {L.sent(reason)}
        </p>
        <p className={styles.risk}>{L('Hold steer + tap. Smaller halves are vulnerable.')}</p>
      </div>
    </div>
  );
}
