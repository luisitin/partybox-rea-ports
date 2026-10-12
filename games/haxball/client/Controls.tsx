import { useRef } from 'react';
import type { JSX, PointerEvent } from 'react';
import { buzz } from '@partybox/game-sdk/ui';
import { directionAt } from './input-state';
import type { ControlAction, Direction, HeldSources } from './input-state';
import styles from './Controller.module.css';

const directions: readonly { action: Direction; arrow: string; label: string }[] = [
  { action: 'up-left', arrow: '↖', label: 'Move up and left' },
  { action: 'up', arrow: '↑', label: 'Move up' },
  { action: 'up-right', arrow: '↗', label: 'Move up and right' },
  { action: 'left', arrow: '←', label: 'Move left' },
  { action: 'right', arrow: '→', label: 'Move right' },
  { action: 'down-left', arrow: '↙', label: 'Move down and left' },
  { action: 'down', arrow: '↓', label: 'Move down' },
  { action: 'down-right', arrow: '↘', label: 'Move down and right' },
];

export function Controls({
  sources,
  update,
  identity,
}: {
  sources: HeldSources;
  update: (source: string, action: ControlAction | null) => void;
  identity: string;
}): JSX.Element {
  const pad = useRef<HTMLDivElement>(null);
  const held = new Set(Object.values(sources));
  const down = (event: PointerEvent<HTMLButtonElement>, action: ControlAction): void => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    update(`pointer:${event.pointerId}`, action);
    buzz(8);
  };
  const up = (event: PointerEvent<HTMLButtonElement>): void =>
    update(`pointer:${event.pointerId}`, null);
  const drag = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !pad.current) return;
    const rect = pad.current.getBoundingClientRect();
    update(
      `pointer:${event.pointerId}`,
      directionAt(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height),
    );
  };
  return (
    <div className={styles.controls}>
      <div
        ref={pad}
        className={styles.pad}
        role="group"
        aria-label="Held movement arrows"
        data-hax-pad="true"
      >
        <span className={styles.padCentre} aria-hidden="true" data-hax-pad-centre="true">
          {identity}
        </span>
        {directions.map(({ action, arrow, label }) => (
          <button
            key={action}
            type="button"
            className={styles.direction}
            data-hax-control={action}
            aria-label={label}
            aria-pressed={held.has(action)}
            data-held={held.has(action) || undefined}
            onPointerDown={(e) => down(e, action)}
            onPointerMove={drag}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={up}
          >
            <span aria-hidden="true">{arrow}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.kick}
        data-hax-control="kick"
        aria-label="Hold Kick near the ball; release after kicking"
        aria-pressed={held.has('kick')}
        data-held={held.has('kick') || undefined}
        onPointerDown={(e) => down(e, 'kick')}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
      >
        <span aria-hidden="true">◎</span>
        <b>Kick</b>
        <small>hold near ball</small>
      </button>
    </div>
  );
}
