// FacePicker (Part 00 §6, P6; Imposter owns it; Who Said It and Nightfall reuse it): a grid of
// faces with names and an optional detail line. Tap to pick; `picks` > 1 makes it a pick-N grid
// (Imposter's two-imposter vote) where a further tap replaces the oldest pick. A tile can be
// disabled with its reason shown. Press and hold a tile (≥ 450 ms) to read its whole detail
// without picking it. The selected face gets a ring AND a ✓ (and its order with pick-N) — never
// colour alone. The confirm button is the caller's (a Screen footer), so the grid stays a grid.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Avatar } from '../../ui/Avatar';
import { buzz } from '../../ui/haptics';
import styles from './FacePicker.module.css';

export interface FaceOption {
  id: string;
  name: string;
  avatarId: string;
  /** One line under the name (ellipsis); the whole text on press-and-hold. */
  detail?: string;
  /** Shown instead of the detail; the tile can't be picked. */
  disabledReason?: string;
}

export interface FacePickerProps {
  options: readonly FaceOption[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  /** How many faces a complete pick holds (default 1). */
  picks?: number;
  /** Columns: default 1 for one or two faces (a runoff), 2 up to 8, 3 above. */
  columns?: 1 | 2 | 3;
  /** Freeze the grid (a vote already locked in, or the phase is over). */
  locked?: boolean;
  /** Accessible name of the grid (translated by the caller). */
  label: string;
}

const HOLD_MS = 450;

export function FacePicker({
  options,
  selected,
  onChange,
  picks = 1,
  columns,
  locked = false,
  label,
}: FacePickerProps): JSX.Element {
  const cols = columns ?? (options.length <= 2 ? 1 : options.length > 8 ? 3 : 2);
  const [peek, setPeek] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const stop = (): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const toggle = (id: string): void => {
    if (locked) return;
    const has = selected.includes(id);
    const next = has
      ? selected.filter((s) => s !== id)
      : [...selected, id].slice(Math.max(0, selected.length + 1 - picks));
    buzz(12);
    onChange(next);
  };

  return (
    <div className={styles.frame}>
      <div
        className={`${styles.grid} ${cols === 3 ? styles.three : cols === 1 ? styles.one : styles.two} ${locked ? styles.locked : ''}`}
        role={picks > 1 ? 'group' : 'radiogroup'}
        aria-label={label}
      >
        {options.map((o) => {
          const order = selected.indexOf(o.id);
          const on = order >= 0;
          const off = o.disabledReason !== undefined;
          return (
            <button
              key={o.id}
              type="button"
              role={picks > 1 ? 'checkbox' : 'radio'}
              aria-checked={on}
              aria-disabled={off || locked}
              className={`${styles.tile} ${on ? styles.on : ''} ${off ? styles.off : ''} ${peek === o.id ? styles.peek : ''}`}
              onPointerDown={() => {
                held.current = false;
                stop();
                timer.current = setTimeout(() => {
                  held.current = true;
                  setPeek(o.id);
                }, HOLD_MS);
              }}
              onPointerUp={stop}
              onPointerLeave={() => {
                stop();
                if (peek === o.id) setPeek(null);
              }}
              onPointerCancel={() => {
                stop();
                setPeek(null);
              }}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                // A press-and-hold was a read, not a pick.
                if (held.current) {
                  held.current = false;
                  setPeek(null);
                  return;
                }
                if (!off) toggle(o.id);
              }}
            >
              <span className={styles.face}>
                <Avatar avatarId={o.avatarId} size="var(--fp-face, 2.5rem)" dim={off} />
                <span className={styles.check} aria-hidden="true">
                  {on ? (picks > 1 ? String(order + 1) : '✓') : ''}
                </span>
              </span>
              <span className={styles.text}>
                <span className={styles.name}>{o.name}</span>
                {off ? (
                  <span className={styles.detail}>{o.disabledReason}</span>
                ) : o.detail ? (
                  <span className={styles.detail}>{o.detail}</span>
                ) : null}
              </span>
              {peek === o.id && o.detail ? (
                <span className={styles.bubble} role="tooltip">
                  {o.detail}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
