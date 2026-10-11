// A horizontal read-out of the dial (Tune In §5.5): the psychic's target with its 2 · 3 · 4 · 3 · 2
// zones (each number printed in its zone), and the phone stage's reveal — faces, the needle, the
// points. Static layout; the zones and faces rise in once, and nothing here takes a touch.
import { useRef } from 'react';
import type { CSSProperties, JSX } from 'react';
import { Avatar } from '../../ui/Avatar';
import styles from './DialStrip.module.css';
import { stackRings, wedges } from './geometry';
import { useBoxPx } from './useBoxPx';

/** What a mark needs sideways: a 24 px face, or with its points the badge above it (T-0121: at a
 *  narrow target close faces' badges piled up and hid a player's own +4). */
const FACE_PX = 26;
const BADGE_PX = 32;

/** Keeps an end's arrow on its word when a label wraps (200 % text). */
const NBSP = '\u00a0';

export interface DialStripMark {
  id: string;
  pos: number;
  avatarId: string;
  pts?: number | null;
  /** Its place in the room's reveal order: with `landWithDial` it lands when the TV lands it. */
  seq?: number;
}

export interface DialStripProps {
  left: string;
  right: string;
  target: number | null;
  bands: readonly [number, number, number];
  marks?: readonly DialStripMark[];
  needle?: number | null;
  showPoints?: boolean;
  /** The labels under the bar (off where the screen already shows them). */
  showEnds?: boolean;
  /** Faces land in step with the TV's `Dial`: after its lid swings, `gapMs` apart in the room's
   *  order (each mark's `seq`), so a face shows on the phone as it lands on the TV (T-0162: the
   *  strip's faces came ~0.5 s early). Without it they land at once, 70 ms apart. */
  landWithDial?: { gapMs: number };
  className?: string;
  label?: string;
}

const ZONE: Record<2 | 3 | 4, string> = {
  2: styles.z2 ?? '',
  3: styles.z3 ?? '',
  4: styles.z4 ?? '',
};

export function DialStrip(props: DialStripProps): JSX.Element {
  const { left, right, target, bands, marks = [], needle = null, showPoints = false } = props;
  const { showEnds = true, className, label, landWithDial } = props;
  const marksRef = useRef<HTMLDivElement>(null);
  const px = useBoxPx(marksRef);
  const gap = px > 0 ? ((showPoints ? BADGE_PX : FACE_PX) / px) * 100 : 8;
  const rings = stackRings(
    marks.map((m) => m.pos),
    gap,
  );
  const lift = Math.max(0, ...rings) + 1;
  return (
    <div
      className={`${styles.strip} ${showPoints ? styles.withPoints : ''} ${landWithDial ? styles.withDial : ''} ${className ?? ''}`}
      style={
        {
          '--rows': marks.length > 0 ? lift : 0,
          ...(landWithDial ? { '--gap': `${landWithDial.gapMs}ms` } : {}),
        } as CSSProperties
      }
      role="img"
      aria-label={label ?? `${left} — ${right}`}
    >
      <div ref={marksRef} className={styles.marks} aria-hidden>
        {marks.map((m, i) => (
          <span
            key={m.id}
            className={styles.mark}
            style={
              { left: `${m.pos}%`, '--ring': rings[i] ?? 0, '--i': m.seq ?? i } as CSSProperties
            }
          >
            <Avatar avatarId={m.avatarId} size={24} />
            {showPoints && m.pts !== null && m.pts !== undefined ? (
              <span className={styles.pts}>{m.pts > 0 ? `+${m.pts}` : '0'}</span>
            ) : null}
          </span>
        ))}
      </div>
      <div className={styles.bar}>
        {target !== null
          ? wedges(target, bands).map((w) => (
              <span
                key={`${w.from}-${w.pts}`}
                className={`${styles.zone} ${ZONE[w.pts]} ${w.from <= 0 ? styles.edgeStart : ''}`}
                style={{ left: `${w.from}%`, width: `${w.to - w.from}%` }}
              >
                {w.label !== null ? <span className={styles.digit}>{w.pts}</span> : null}
              </span>
            ))
          : null}
        {needle !== null ? <span className={styles.needle} style={{ left: `${needle}%` }} /> : null}
        {/* Nothing on the bar yet: it scans, a radio looking for the station (never a dead box). */}
        {target === null && needle === null && marks.length === 0 ? (
          <span className={styles.scan} aria-hidden />
        ) : null}
      </div>
      {showEnds ? (
        <div className={styles.ends}>
          <span className={styles.endLeft}>{`◀${NBSP}${left}`}</span>
          <span className={styles.endRight}>{`${right}${NBSP}▶`}</span>
        </div>
      ) : null}
    </div>
  );
}
