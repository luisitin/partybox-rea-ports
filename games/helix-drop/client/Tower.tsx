// Original elliptical SVG rings: open gaps, cross-marked danger, and a fixed landing arrow.
import type { CSSProperties, JSX } from 'react';
import type { Lane } from '../server/index';
import { angleDifference } from '../server/content';
import styles from './Tower.module.css';

function point(degrees: number, radius: number, cy: number): string {
  const a = (degrees * Math.PI) / 180;
  return `${100 + Math.sin(a) * radius},${cy + Math.cos(a) * radius * 0.26}`;
}

function wedge(from: number, to: number, cy: number): string {
  return `M${point(from, 72, cy)} A72,18.72 0 0 0 ${point(to, 72, cy)} L${point(to, 23, cy)} A23,5.98 0 0 1 ${point(from, 23, cy)} Z`;
}

export const slotStyle = (slot: number): CSSProperties =>
  ({ '--lane-color': `var(--pb-player-${(slot % 8) + 1})` }) as CSSProperties;

export function Tower({ lane }: { lane: Lane }): JSX.Element {
  const base = lane.rings[0]?.index ?? 0;
  const ballY = Math.max(20, Math.min(172, 69 + (lane.y - base) * 52));
  return (
    <svg
      className={styles.tower}
      viewBox="0 0 200 200"
      role="img"
      aria-label={`Tower: floor ${lane.floor}, best ${lane.best}, ${lane.lives} lives${lane.chain >= 3 ? ', smash charged' : ''}`}
      style={slotStyle(lane.slot)}
    >
      <rect x="91" y="8" width="18" height="182" rx="7" className={styles.column} />
      {lane.rings.map((ring) => {
        const cy = 58 + (ring.index - base) * 52;
        return (
          <g key={ring.index}>
            {Array.from({ length: 72 }, (_, i) => {
              const from = i * 5;
              const mid = from + 2.5;
              if (Math.abs(angleDifference(mid, ring.gap + lane.angle)) < ring.width / 2)
                return null;
              const danger =
                ring.dangerWidth > 0 &&
                Math.abs(angleDifference(mid, ring.danger + lane.angle)) < ring.dangerWidth / 2;
              return (
                <path
                  key={i}
                  d={wedge(from, from + 5.1, cy)}
                  className={danger ? styles.danger : styles.safe}
                />
              );
            })}
            {Array.from({ length: Math.floor(ring.dangerWidth / 20) }, (_, i) => {
              const a = ring.danger + lane.angle - ring.dangerWidth / 2 + 10 + i * 20;
              const [x, y] = point(a, 48, cy).split(',').map(Number);
              return (
                <path
                  key={i}
                  d={`M${x! - 3},${y! - 3} l6,6 m-6,0 l6,-6`}
                  className={styles.cross}
                />
              );
            })}
            <text x="12" y={cy + 5} className={styles.floor}>
              {ring.index + 1}
            </text>
          </g>
        );
      })}
      <path d="M100,22 v14 m-5,-5 l5,5 5,-5" className={styles.arrow} />
      <circle
        cx="100"
        cy={ballY}
        r="8"
        className={lane.chain >= 3 ? styles.charged : styles.ball}
      />
      {lane.recovering || lane.lives === 0 ? (
        <path d={`M94,${ballY - 6} l12,12 m-12,0 l12,-12`} className={styles.cross} />
      ) : null}
    </svg>
  );
}
