// The phone's big button (T-0646): a pointer press acts at once (the server judges by its own clock); a click with no pointer
// (a gamepad's A, a keyboard) acts too. The game decides what each button means and draws its icon.
import type { JSX, ReactNode } from 'react';
import { buzz } from '../../ui/haptics';
import styles from './ActButton.module.css';

export interface ActButtonProps {
  label: string;
  icon?: ReactNode;
  onAct: () => void;
  /** Dimmed and ignored: a cooldown, nothing to do right now. */
  off?: boolean;
  /** 0-360: the button's colour; default is the theme's accent. */
  hue?: number;
  /** A small badge (balls waiting, bottles ready). */
  badge?: number | string;
  /** The primary button of the screen (the shell's gamepad A). */
  primary?: boolean;
  /** Fills the row or the screen taller than the usual button. */
  tall?: boolean;
  /** A small, square button for a grid of choices. */
  small?: boolean;
}

export function ActButton({
  label,
  icon,
  onAct,
  off,
  hue,
  badge,
  primary,
  tall,
  small,
}: ActButtonProps): JSX.Element {
  const press = (): void => {
    if (off) return;
    buzz(8);
    onAct();
  };
  return (
    <button
      type="button"
      className={styles.btn}
      data-off={off === true}
      data-tall={tall === true}
      data-small={small === true}
      data-pad-primary={primary ? '' : undefined}
      aria-label={label}
      aria-disabled={off === true}
      style={hue === undefined ? undefined : { ['--hue' as string]: hue }}
      onPointerDown={press}
      onClick={(e) => {
        if (e.detail === 0) press();
      }}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className={styles.label}>{label}</span>
      {badge !== undefined && badge !== 0 ? (
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
