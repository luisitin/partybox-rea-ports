// Touch-down turns immediately; keyboard activation sends once and has identical screen directions.
import { useCallback, useEffect } from 'react';
import type { JSX } from 'react';
import { buzz, useT } from '@partybox/game-sdk/ui';
import type { PaperTerritoryControllerView } from '../server/index';
import type { Direction, Input } from '../server/types';
import { canSteer, directionForKey, directionRequest, DIRECTIONS } from './controls';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function DirectionPad({
  view,
  send,
}: {
  view: PaperTerritoryControllerView;
  send: (input: Input) => void;
}): JSX.Element {
  const L = useT(STRINGS);
  const disabled = !canSteer(view);
  const turn = useCallback(
    (dir: Direction): void => {
      const request = directionRequest(view, dir);
      if (!request) return;
      send(request);
      buzz(8);
    },
    [view.phaseId, view.paused, view.alive, view.me.role, send],
  );
  useEffect(() => {
    if (disabled) return;
    const key = (event: KeyboardEvent): void => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      const dir = directionForKey(event.key);
      if (dir === null || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      turn(dir);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [disabled, turn]);
  return (
    <div className={styles.pad} role="group" aria-label={L('Direction controls')}>
      {DIRECTIONS.map((button) => (
        <button
          key={button.dir}
          type="button"
          className={`${styles.direction} ${styles[button.position]}`}
          disabled={disabled}
          aria-label={L('Go {direction}', { direction: L(button.name).toLowerCase() })}
          aria-pressed={view.dir === button.dir}
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.preventDefault();
            turn(button.dir);
          }}
          onClick={(event) => {
            if (event.detail === 0) turn(button.dir);
          }}
        >
          <span aria-hidden="true">{button.arrow}</span>
          {L(button.name)}
        </button>
      ))}
      <div className={styles.padCenter}>{disabled ? L('One moment') : L('You keep moving')}</div>
    </div>
  );
}
