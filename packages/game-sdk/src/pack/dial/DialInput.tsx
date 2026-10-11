// The phone dial (P00 §6, Tune In §5.5, T-0359): the same semicircle the TV shows, with the 0–100
// value as an angle round the pivot. A 48 px thumb follows the finger; a tap anywhere on the dial
// jumps it there (below the pivot it snaps to the nearer end); − / + (44 × 44) for fine moves; a
// haptic tick every 10 (Android). The thumb starts at the top and does not count until moved.
// Teammates' faces (24 px) ride outside the rim and a bold spoke marks the team needle. The dial
// owns every touch (no scroll, no zoom, no select).
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, PointerEvent } from 'react';
import { Avatar } from '../../ui/Avatar';
import { buzz } from '../../ui/haptics';
import styles from './DialInput.module.css';
import { BOX, pointAt, posFromPoint, slicePath } from './geometry';

/** Keeps an end's arrow on its word when a label wraps (200 % text). */
const NBSP = '\u00a0';

export interface DialInputMark {
  id: string;
  pos: number;
  avatarId: string;
}

export interface DialInputProps {
  left: string;
  right: string;
  /** The player's dial; null = not moved yet (the thumb waits in the middle, dashed). */
  value: number | null;
  /** Every move while the finger is down (throttle it for a huddle). */
  onMove?: (pos: number) => void;
  /** The finger lifted, or a − / + step: the value to keep. */
  onCommit: (pos: number) => void;
  marks?: readonly DialInputMark[];
  needle?: number | null;
  disabled?: boolean;
  /** Locked in: the thumb wears a ring (moving it still works, and unlocks). */
  locked?: boolean;
  /** The game's words: the − / + buttons, the slider's name, the untouched hint. */
  words: { minus: string; plus: string; slider: string; hint: string };
}

/** A point on the dial at `pos`, `radius` out from the pivot, as percentages of the box. */
const spot = (pos: number, radius: number): CSSProperties => {
  const p = pointAt(pos, radius);
  return { left: `${(p.x / BOX.w) * 100}%`, top: `${(p.y / BOX.h) * 100}%` };
};
const TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

export function DialInput(props: DialInputProps): JSX.Element {
  const { left, right, value, onMove, onCommit, marks = [], needle = null } = props;
  const { disabled = false, locked = false, words } = props;
  const [pos, setPos] = useState<number | null>(value);
  const [dragging, setDragging] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  // Refs, not state, for the gesture: pointerup and lostpointercapture fire back to back before a
  // re-render, and a stale flag would commit twice.
  const live = useRef({ down: false, pos: value });
  const lastTen = useRef<number | null>(value === null ? null : Math.floor(value / 10));
  // The server's value wins whenever the finger is up (a reconnect, a VIP skip).
  useEffect(() => {
    if (live.current.down) return;
    live.current.pos = value;
    setPos(value);
  }, [value]);

  const place = (next: number, commit: boolean): void => {
    const ten = Math.floor(next / 10);
    if (lastTen.current !== null && ten !== lastTen.current) buzz(6);
    lastTen.current = ten;
    live.current.pos = next;
    setPos(next);
    if (commit) onCommit(next);
    else onMove?.(next);
  };
  const at = (e: PointerEvent<HTMLDivElement>): number => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 50;
    const unit = rect.width / BOX.w;
    return posFromPoint((e.clientX - rect.left) / unit, (e.clientY - rect.top) / unit);
  };
  const down = (e: PointerEvent<HTMLDivElement>): void => {
    if (disabled || !e.isPrimary || live.current.down) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current.down = true;
    setDragging(true);
    place(at(e), false);
  };
  const move = (e: PointerEvent<HTMLDivElement>): void => {
    if (!live.current.down || !e.isPrimary) return;
    const next = at(e);
    if (next !== live.current.pos) place(next, false);
  };
  const end = (e: PointerEvent<HTMLDivElement> | null): void => {
    if (!live.current.down) return;
    live.current.down = false;
    setDragging(false);
    const final = e ? at(e) : live.current.pos;
    if (final !== null) place(final, true);
  };
  const step = (delta: number): void => {
    if (disabled) return;
    place(Math.min(100, Math.max(0, (live.current.pos ?? 50) + delta)), true);
  };
  const shown = pos ?? 50;
  const untouched = pos === null;
  return (
    <div className={`${styles.dial} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.ends} aria-hidden>
        <span className={styles.endLeft}>{`◀${NBSP}${left}`}</span>
        <span className={styles.endRight}>{`${right}${NBSP}▶`}</span>
      </div>
      <div
        className={`${styles.hit} ${dragging ? styles.dragging : ''}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => (e.isPrimary ? end(e) : undefined)}
        onPointerCancel={() => end(null)}
        onLostPointerCapture={() => end(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div ref={track} className={styles.box}>
          <svg className={styles.svg} viewBox={`0 0 ${BOX.w} ${BOX.h}`} aria-hidden>
            <path d={slicePath(0, 100, BOX.rim)} className={styles.bezel} />
            <path d={slicePath(0, 100, BOX.face)} className={styles.face} />
            {TICKS.map((t) => {
              const a = pointAt(t, BOX.face - (t === 50 ? 34 : 18));
              const b = pointAt(t, BOX.face);
              return (
                <line
                  key={t}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={t === 50 ? styles.tickMid : styles.tick}
                />
              );
            })}
            {needle !== null ? (
              <line
                className={styles.needle}
                x1={BOX.cx}
                y1={BOX.cy}
                x2={pointAt(needle, BOX.face).x}
                y2={pointAt(needle, BOX.face).y}
              />
            ) : null}
          </svg>
          {marks.map((m) => (
            <span key={m.id} className={styles.mark} style={spot(m.pos, BOX.rim + 44)} aria-hidden>
              <Avatar avatarId={m.avatarId} size={24} />
            </span>
          ))}
          <span className={styles.thumbSlot} style={spot(shown, BOX.face * 0.82)}>
            <span
              className={`${styles.thumb} ${untouched ? styles.untouched : ''} ${locked ? styles.locked : ''}`}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label={words.slider}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={shown}
              aria-valuetext={untouched ? words.hint : `${shown}`}
              aria-disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(e.shiftKey ? -10 : -1);
                else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(e.shiftKey ? 10 : 1);
                else return;
                e.preventDefault();
              }}
            />
          </span>
        </div>
      </div>
      <div className={styles.steps}>
        <button
          type="button"
          className={styles.step}
          aria-label={words.minus}
          onClick={() => step(-1)}
          disabled={disabled}
        >
          −
        </button>
        <span className={styles.hint} aria-hidden>
          {untouched ? words.hint : ''}
        </span>
        <button
          type="button"
          className={styles.step}
          aria-label={words.plus}
          onClick={() => step(1)}
          disabled={disabled}
        >
          +
        </button>
      </div>
    </div>
  );
}
