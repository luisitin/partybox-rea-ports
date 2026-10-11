// The TV dial (P00 §6, Tune In §5.5): a semicircle gauge with the two ends at its feet, the target's
// five wedges (2 · 3 · 4 · 3 · 2, each number printed inside, so colour is never the only signal)
// under a shutter that swings away around the pivot (transform only), a needle, and the players'
// faces riding arms from the pivot so a huddle glides and a reveal lands without layout work.
import { useRef } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { Avatar } from '../../ui/Avatar';
import styles from './Dial.module.css';
import { BOX, faceLayout, pointAt, posToDeg, slicePath, spokes, wedges } from './geometry';
import { useBoxPx } from './useBoxPx';

/** Keeps an end's arrow on its word when a label wraps (200 % text). */
const NBSP = '\u00a0';

/** T-0110: the longest unbreakable run of an end label (its arrow rides the first or last word),
 *  so the CSS can shrink a long word to its column instead of breaking it ("Unfashionabl / e"). */
function endFit(label: string): CSSProperties {
  const longest = Math.max(0, ...label.split(/\s+/).map((w) => w.length));
  return { '--end-chars': longest + 2 } as CSSProperties;
}

export interface DialMarker {
  id: string;
  pos: number;
  avatarId: string;
  /** "+4" over the face once `showPoints` (null: nothing). */
  pts?: number | null;
}

export interface DialProps {
  left: string;
  right: string;
  /** The target; null keeps the face blank under the shutter (nothing to leak). */
  target: number | null;
  /** The 4 / 3 / 2 band edges for the target size. */
  bands: readonly [number, number, number];
  /** Shutter state. `swing` animates it open on mount (the reveal); otherwise it is just open. */
  open: boolean;
  swing?: boolean;
  markers?: readonly DialMarker[];
  /** Faces land one after another (reveal) instead of gliding (huddle). */
  landing?: boolean;
  needle?: number | null;
  /** The needle swings up from rest to its spot (reveal) instead of following live. */
  needleSettles?: boolean;
  /** A badge on the needle's tip ("+3"). */
  needleBadge?: ReactNode;
  showPoints?: boolean;
  /** The face flips toward the room as a new dial comes up. */
  entrance?: boolean;
  /** Stagger unit for landing faces (ms); the first lands after the shutter. */
  landGapMs?: number;
  className?: string;
  label?: string;
}

const TICKS = Array.from({ length: 21 }, (_, i) => i * 5);
const f = (n: number): string => n.toFixed(2);
const ZONE_CLASS: Record<2 | 3 | 4, string> = {
  2: styles.zone2 ?? '',
  3: styles.zone3 ?? '',
  4: styles.zone4 ?? '',
};

/** An arm from the pivot to (x, y) in box units: its length and turn. */
function faceStyle(x: number, y: number, i: number, landGapMs: number): CSSProperties {
  const radius = Math.hypot(x - BOX.cx, BOX.cy - y);
  const deg = (Math.atan2(BOX.cy - y, x - BOX.cx) * 180) / Math.PI;
  return {
    '--arm': `${(radius / BOX.w) * 100}%`,
    '--deg': `${-deg}deg`,
    '--i': i,
    '--gap': `${landGapMs}ms`,
  } as CSSProperties;
}

/** The needle's own badge rides partway along it, clear of the faces on the rim. */
function needleBadgeStyle(needle: number, landGapMs: number): CSSProperties {
  const p = pointAt(needle, BOX.face * 0.58);
  return faceStyle(p.x, p.y, 0, landGapMs);
}

export function Dial(props: DialProps): JSX.Element {
  const { left, right, target, bands, open, swing = false, markers = [], landing = false } = props;
  const { needle = null, needleSettles = false, needleBadge, showPoints = false } = props;
  const { entrance = false, landGapMs = 90, className, label } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const layout = faceLayout(useBoxPx(boxRef));
  // Every face over its own value, as on the phone's strip (T-0162): a huddle's faces glide along
  // the rim; the reveal stacks a crowd out along each face's spoke, a leader line back to its spot.
  // A crowd too big for its spokes slides along the rim, but never off the number it scored.
  const zones = target === null ? [] : wedges(target, bands);
  const range = (p: number): readonly [number, number] => {
    const own = zones.filter((w) => p >= w.from - 1e-9 && p <= w.to + 1e-9);
    const w = own.sort((a, b) => b.pts - a.pts)[0];
    if (w) return [w.from, w.to];
    const below = zones.filter((z) => z.to <= p).map((z) => z.to);
    const above = zones.filter((z) => z.from >= p).map((z) => z.from);
    return [Math.max(0, ...below), Math.min(100, ...above)];
  };
  const slots = landing
    ? spokes(
        markers.map((m) => m.pos),
        layout,
        { range },
      )
    : markers.map((m) => ({ ...pointAt(m.pos, layout.rim), at: m.pos, step: 0 }));
  const leaders = landing
    ? markers.flatMap((m, i) => {
        const slot = slots[i];
        if (!slot || (slot.step === 0 && Math.abs(slot.at - m.pos) < 0.3)) return [];
        const a = pointAt(m.pos, BOX.rim + 2);
        // stop at the face's edge
        const k = Math.min(1, 22 / Math.max(1, Math.hypot(a.x - slot.x, a.y - slot.y)));
        const b = { x: slot.x + (a.x - slot.x) * k, y: slot.y + (a.y - slot.y) * k };
        return [{ id: m.id, a, b }];
      })
    : [];
  return (
    <div
      className={`${styles.wrap} ${entrance ? styles.entrance : ''} ${className ?? ''}`}
      role="img"
      aria-label={label ?? `${left} — ${right}`}
    >
      <span className={`${styles.end} ${styles.endLeft}`} style={endFit(left)}>
        <span className={styles.endText}>{`◀${NBSP}${left}`}</span>
      </span>
      <div ref={boxRef} className={styles.box}>
        {/* The still parts are one SVG, painted once; everything that moves is its own layer. */}
        <svg className={styles.svg} viewBox={`0 0 ${BOX.w} ${BOX.h}`} aria-hidden>
          <path d={slicePath(0, 100, BOX.rim)} className={styles.bezel} />
          <path d={slicePath(0, 100, BOX.face)} className={styles.face} />
          {target !== null && (open || swing) ? (
            <g className={styles.wedges}>
              {wedges(target, bands).map((w) => (
                <path
                  key={`${w.from}-${w.pts}`}
                  d={slicePath(w.from, w.to, BOX.face)}
                  className={ZONE_CLASS[w.pts]}
                />
              ))}
              {wedges(target, bands).map((w) => {
                if (w.label === null) return null;
                const p = pointAt(w.label, BOX.face * 0.8);
                return (
                  <text
                    key={`t${w.from}`}
                    x={f(p.x)}
                    y={f(p.y)}
                    className={`${styles.zoneText} ${w.pts === 4 ? styles.zoneText4 : ''}`}
                  >
                    {w.pts}
                  </text>
                );
              })}
            </g>
          ) : null}
          {TICKS.map((pos) => {
            const a = pointAt(pos, BOX.face + 6);
            const b = pointAt(pos, BOX.face + (pos % 10 === 0 ? 26 : 16));
            return (
              <line
                key={pos}
                x1={f(a.x)}
                y1={f(a.y)}
                x2={f(b.x)}
                y2={f(b.y)}
                className={styles.tick}
              />
            );
          })}
        </svg>
        {!open || swing ? <Shutter swing={swing} /> : null}
        {leaders.length > 0 ? (
          <svg
            className={`${styles.svg} ${styles.leaders}`}
            viewBox={`0 0 ${BOX.w} ${BOX.h}`}
            aria-hidden
          >
            {leaders.map(({ id, a, b }) => (
              <line
                key={id}
                x1={f(a.x)}
                y1={f(a.y)}
                x2={f(b.x)}
                y2={f(b.y)}
                className={styles.leader}
              />
            ))}
          </svg>
        ) : null}
        {needle !== null ? (
          <span
            className={`${styles.needle} ${needleSettles ? styles.settle : ''}`}
            style={{ '--deg': `${-posToDeg(needle)}deg` } as CSSProperties}
            aria-hidden
          />
        ) : null}
        <span className={styles.hub} aria-hidden />
        {needle !== null && needleBadge ? (
          <span className={styles.arm} style={needleBadgeStyle(needle, landGapMs)}>
            <span className={styles.upright}>
              <span className={`${styles.badge} ${styles.needleBadge}`}>{needleBadge}</span>
            </span>
          </span>
        ) : null}
        {markers.map((m, i) => (
          <span
            key={m.id}
            className={`${styles.arm} ${landing ? '' : styles.glide}`}
            style={faceStyle(
              slots[i]?.x ?? BOX.cx,
              slots[i]?.y ?? BOX.cy - layout.rim,
              i,
              landGapMs,
            )}
          >
            <span className={`${styles.upright} ${landing ? '' : styles.glide}`}>
              <span className={landing ? styles.land : styles.face40}>
                <Avatar avatarId={m.avatarId} size={40} />
                {showPoints && m.pts !== null && m.pts !== undefined ? (
                  <span className={`${styles.badge} ${m.pts === 0 ? styles.badgeZero : ''}`}>
                    {m.pts > 0 ? `+${m.pts}` : '0'}
                  </span>
                ) : null}
              </span>
            </span>
          </span>
        ))}
      </div>
      <span className={`${styles.end} ${styles.endRight}`} style={endFit(right)}>
        <span className={styles.endText}>{`${right}${NBSP}▶`}</span>
      </span>
    </div>
  );
}

/** The lid: its own layer (a rotating HTML box holding a half disc), clipped at the baseline, so
 *  the swing is composited instead of repainting the dial every frame. */
function Shutter({ swing }: { swing: boolean }): JSX.Element {
  return (
    <span className={styles.shutterClip} aria-hidden>
      <span className={`${styles.shutter} ${swing ? styles.swing : ''}`}>
        <svg className={styles.svg} viewBox={`0 0 ${BOX.w} ${BOX.h}`}>
          <path d={slicePath(0, 100, BOX.face + 2)} className={styles.shutterFace} />
          <path d={slicePath(0, 100, BOX.face * 0.34)} className={styles.shutterHub} />
          {[0.5, 0.64, 0.78, 0.92].map((k) => (
            <path
              key={k}
              d={`M ${f(BOX.cx - BOX.face * k)} ${BOX.cy} A ${BOX.face * k} ${BOX.face * k} 0 0 1 ${f(BOX.cx + BOX.face * k)} ${BOX.cy}`}
              className={styles.grille}
            />
          ))}
        </svg>
      </span>
      {/* A closed lid is never still: a faint glint sweeps it, a radio searching for a station. */}
      {swing ? null : <span className={styles.glint} />}
    </span>
  );
}
