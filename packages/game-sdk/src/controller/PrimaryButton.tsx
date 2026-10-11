// The one big button: ≥ 56 px tall, full width, explicit disabled/busy/done states. A disabled
// button is `aria-disabled`, not DOM-disabled, so a tap on it still reaches us: it shakes once and
// buzzes 10 ms, pulling the eye to the reason the caller prints above it (Safari and Firefox fire
// no click on a disabled button, so the acknowledgement needs the attribute route).
// T-0225: a mash sends once (`isMash`): a second tap on the same button inside MASH_MS is dropped
// (the echo that would mark it done is still on the Wi-Fi), and so is a tap of a burst that began
// on the previous screen and landed on this freshly shown button. `busy` is a send on its way:
// inert and quiet, neutral, no ✓ (a green ✓ reads as delivered).
import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, JSX } from 'react';
import { buzz } from '../ui/haptics';
import { isMash, PAGE_MASH_CLOCK } from './mash';
import styles from './PrimaryButton.module.css';

export interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'accent' | 'neutral' | 'danger' | 'success';
  /** Shows a ✓ and disables (e.g. "Submitted"); a tap on it is silently inert. */
  done?: boolean;
  /** Sent, waiting for the server: inert without a shake, neutral, no ✓ (e.g. "Sending…"). */
  busy?: boolean;
  /** A quick second tap means something (Bingo's arm-then-claim): no mash guard. */
  repeatTaps?: boolean;
  /** T-0392: why it is disabled ("Type one word first"); printed under the button only while disabled. */
  reason?: string;
}

export function PrimaryButton({
  tone = 'accent',
  done,
  busy,
  repeatTaps,
  reason,
  className,
  children,
  disabled,
  onClick,
  onAnimationEnd,
  ...rest
}: PrimaryButtonProps): JSX.Element {
  const [shaking, setShaking] = useState(false);
  const inert = Boolean(disabled || done || busy);
  const shownAt = useRef(0);
  const lastTap = useRef(-Infinity);
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);
  /** Every tap feeds the page's burst clock; only a tap that is not part of a mash acts. */
  const mashed = (): boolean => {
    const now = performance.now();
    const mash = isMash(PAGE_MASH_CLOCK, now, shownAt.current, lastTap.current);
    lastTap.current = now;
    return mash && !repeatTaps;
  };
  const button = (
    <button
      type="button"
      className={`${styles.button} ${styles[tone]} ${done ? styles.done : ''} ${busy && !done ? styles.busy : ''} ${shaking ? styles.shake : ''} ${className ?? ''}`}
      aria-disabled={inert}
      aria-busy={busy && !done ? true : undefined}
      onClick={(e) => {
        const mash = mashed();
        if (!inert && !mash) {
          onClick?.(e);
          return;
        }
        // Stops a type="submit" from submitting (and from showing the native `required` bubble).
        e.preventDefault();
        if (!inert || done || busy) return;
        setShaking(true);
        buzz(10);
      }}
      onAnimationEnd={(e) => {
        setShaking(false);
        onAnimationEnd?.(e);
      }}
      {...rest}
    >
      {done ? (
        <span className={styles.check} aria-hidden>
          ✓
        </span>
      ) : null}
      {children}
    </button>
  );
  if (!reason || !disabled || done || busy) return button;
  return (
    <div className={styles.wrap}>
      {button}
      <span className={styles.reason} role="status">
        {reason}
      </span>
    </div>
  );
}
