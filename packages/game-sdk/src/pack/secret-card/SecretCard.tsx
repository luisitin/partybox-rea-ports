// SecretCard (Part 00 §6, P6; Imposter owns it): a card that shows its back ("Tap to see your
// word") until the player taps it — then it turns face-up in 3D and hides itself again (3 s on the
// 56 px strip beside a text field, 5 s on the full card), so a neighbour can't read it over a
// shoulder and nobody has to pin a thumb on it while the other hand types (T-0391). After the
// first look the back says `againLabel` ("Show again"). A per-device preference (owner ruling 20:
// a shell-level device setting) switches to hold-to-see: press and hold, turns back on release.
// Hardened for real fingers: no text selection, no iOS callout, no Android context menu, a finger
// that slides off still holds (pointer capture), and a cancelled pointer turns the card back.
// Transform-only flip (opacity beside a 3D turn flattens Chromium's 3D context — DESIGN_SYSTEM).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { JSX, KeyboardEvent, ReactNode } from 'react';
import { buzz } from '../../ui/haptics';
import styles from './SecretCard.module.css';

export type SecretCardMode = 'hold' | 'tap';
const KEY = 'partybox:secret-card';
const AUTO_HIDE_MS = 5000;
const AUTO_HIDE_MINI_MS = 3000;
const listeners = new Set<() => void>();

/** How long a tap-revealed card stays face-up. */
export function autoHideMs(size: 'full' | 'mini'): number {
  return size === 'mini' ? AUTO_HIDE_MINI_MS : AUTO_HIDE_MS;
}

/** The back's line: once seen (tap mode) the caller's "Show again", else the first-look line. */
export function backText(
  how: SecretCardMode,
  seen: boolean,
  backLabel: string,
  againLabel?: string,
): string {
  return how === 'tap' && seen && againLabel ? againLabel : backLabel;
}

/** The control's accessible name carries the back's visible words once they change (WCAG 2.5.3). */
export function controlLabel(
  label: string,
  how: SecretCardMode,
  seen: boolean,
  againLabel?: string,
): string {
  return how === 'tap' && seen && againLabel ? `${label}: ${againLabel}` : label;
}

export function getSecretCardMode(): SecretCardMode {
  try {
    return localStorage.getItem(KEY) === 'hold' ? 'hold' : 'tap';
  } catch {
    return 'tap';
  }
}

export function setSecretCardMode(mode: SecretCardMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* private mode: the default stays */
  }
  for (const l of listeners) l();
}

/** The device's preference, live (the 🎨 sheet can change it while a card is up). */
export function useSecretCardMode(): SecretCardMode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSecretCardMode,
    () => 'tap',
  );
}

export interface SecretCardProps {
  /** The face: what only this player may see. */
  children: ReactNode;
  /** The back's line (default "Hold to see your word"); the same for every role. */
  backLabel: string;
  /** Under the back's line, e.g. "Tap to see your word" in tap mode — the caller translates. */
  backHint?: ReactNode;
  /** `full` = the deal card; `mini` = a 56 px strip that flips on its long axis. */
  size?: 'full' | 'mini';
  /** Accessible name of the control (translated by the caller). */
  label: string;
  /** The back's line once the card has been seen (tap mode), e.g. "Show again" — translated. */
  againLabel?: string;
  /** Force a mode (tests, previews); default: the device's preference. */
  mode?: SecretCardMode;
  /** Called when the card turns face-up (games may log a peek). */
  onPeek?: () => void;
  className?: string;
}

export function SecretCard({
  children,
  backLabel,
  backHint,
  againLabel,
  size = 'full',
  label,
  mode,
  onPeek,
  className,
}: SecretCardProps): JSX.Element {
  const deviceMode = useSecretCardMode();
  const how = mode ?? deviceMode;
  const [shown, setShown] = useState(false);
  const [seen, setSeen] = useState(false);
  const hideAt = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHide = (): void => {
    if (hideAt.current) clearTimeout(hideAt.current);
    hideAt.current = null;
  };
  const show = useCallback(() => {
    setShown((was) => {
      if (!was) {
        setSeen(true);
        buzz(10);
        onPeek?.();
      }
      return true;
    });
  }, [onPeek]);
  const hide = useCallback(() => {
    clearHide();
    setShown(false);
  }, []);
  useEffect(() => clearHide, []);
  // Tap mode: a shown card hides itself after 3 s (strip) or 5 s (full card).
  useEffect(() => {
    if (how !== 'tap' || !shown) return;
    clearHide();
    hideAt.current = setTimeout(() => setShown(false), autoHideMs(size));
    return clearHide;
  }, [how, shown, size]);
  // A card left face-up when the page hides (app switch, lock screen) turns back.
  useEffect(() => {
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') hide();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [hide]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (e.repeat) return;
    if (how === 'tap') {
      if (shown) hide();
      else show();
    } else show();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (how === 'hold' && (e.key === ' ' || e.key === 'Enter')) hide();
  };
  return (
    <div
      className={`${styles.card} ${size === 'mini' ? styles.mini : styles.full} ${shown ? styles.shown : ''} ${className ?? ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={shown}
      aria-label={controlLabel(label, how, seen, againLabel)}
      data-secret-card={shown ? 'face' : 'back'}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (how === 'tap') {
          if (shown) hide();
          else show();
          return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        show();
      }}
      onPointerUp={() => how === 'hold' && hide()}
      onPointerCancel={() => how === 'hold' && hide()}
      onLostPointerCapture={() => how === 'hold' && hide()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={() => how === 'hold' && hide()}
    >
      <div className={styles.turn}>
        <div className={styles.back} aria-hidden={shown}>
          <span className={styles.glyph} aria-hidden="true">
            ✋
          </span>
          <span className={styles.backLabel}>{backText(how, seen, backLabel, againLabel)}</span>
          {backHint ? <span className={styles.backHint}>{backHint}</span> : null}
        </div>
        <div className={styles.face} aria-hidden={!shown}>
          {children}
        </div>
      </div>
    </div>
  );
}
