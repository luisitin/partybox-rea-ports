// The phone's pads (T-0636): one or two big buttons. A pointer press sends at once (the server judges by its own clock);
// a click with no pointer (a gamepad's A, a keyboard) sends too. The first pad is the primary one for the shell's pad.
import type { JSX } from 'react';
import { buzz } from '../../ui/haptics';
import type { RhythmPad } from './types';
import styles from './Pad.module.css';

export interface PadProps {
  pads: readonly RhythmPad[];
  onTap: (lane: number) => void;
  /** A stray tap locked the pads: they dim and shake until it ends (the server ignores taps meanwhile). */
  locked?: boolean;
}

export function Pad({ pads, onTap, locked }: PadProps): JSX.Element {
  const press = (lane: number): void => {
    buzz(8);
    onTap(lane);
  };
  return (
    <div className={styles.pads} data-count={pads.length} data-locked={locked === true}>
      {pads.map((pad, lane) => (
        <button
          key={lane}
          type="button"
          className={styles.pad}
          data-pad-primary={lane === 0 ? '' : undefined}
          aria-label={pad.label}
          onPointerDown={() => press(lane)}
          onClick={(e) => {
            if (e.detail === 0) press(lane);
          }}
        >
          <span className={styles.icon} aria-hidden="true">
            {pad.icon}
          </span>
          <span className={styles.label}>{pad.label}</span>
        </button>
      ))}
    </div>
  );
}
