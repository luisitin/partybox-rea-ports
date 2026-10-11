// Two simultaneous thumb targets: absolute heading and a separate, costly hold-to-boost action.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { Input } from '../server/types';
import { STRINGS } from './strings';
import { useSteering } from './useSteering';
import styles from './Controls.module.css';

interface ControlsProps {
  angle: number;
  mass: number;
  enabled: boolean;
  send: (input: Input) => void;
}

export function Controls({ angle, mass, enabled, send }: ControlsProps): JSX.Element {
  const L = useT(STRINGS);
  const canBoost = mass > 8;
  const controls = useSteering({ angle, enabled, canBoost, send });
  return (
    <div className={styles.controls} role="group" aria-label={L('Snake controls')}>
      <button
        type="button"
        className={styles.pad}
        disabled={!enabled}
        aria-label={L('Direction pad. Drag toward your heading, or use arrow keys or WASD.')}
        {...controls.steerHandlers}
      >
        <svg className={styles.direction} viewBox="0 0 100 100" aria-hidden="true">
          <circle className={styles.padRing} cx="50" cy="50" r="37" />
          <path
            className={styles.compass}
            d="M50 6l-3 6h6ZM94 50l-6-3v6ZM50 94l3-6h-6ZM6 50l6 3v-6Z"
          />
          <g transform={`rotate(${(controls.angle * 180) / Math.PI} 50 50)`}>
            <path className={styles.heading} d="M34 50H69M60 40l10 10-10 10" />
          </g>
        </svg>
        <span className={styles.label}>{L('DRAG TO STEER')}</span>
      </button>
      <button
        type="button"
        className={styles.boost}
        disabled={!enabled || !canBoost}
        aria-pressed={controls.boosting}
        aria-label={L('Hold BOOST to sprint. Spends 3 size per second. Space or Shift also works.')}
        data-held={controls.boosting || undefined}
        {...controls.boostHandlers}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            controls.boostKey(true, event.code);
          }
        }}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            controls.boostKey(false, event.code);
          }
        }}
        onBlur={controls.blurBoost}
      >
        <span className={styles.bolt} aria-hidden="true">
          ↯
        </span>
        <b>{L('BOOST')}</b>
        <span className={styles.cost}>
          {canBoost ? L('Hold · −3 size/s') : L('Needs size above 8')}
        </span>
      </button>
    </div>
  );
}
