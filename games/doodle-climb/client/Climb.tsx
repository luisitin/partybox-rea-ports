// Original platform and capsule art. Only server positions are drawn; the client never advances physics.
import type { JSX } from 'react';
import type { Climber, Platform } from '../server/types';
import styles from './Climb.module.css';

export interface ClimbProps {
  climber: Climber;
  platforms: Platform[];
  slot: number;
  label: string;
}

export function Climb({ climber, platforms, slot, label }: ClimbProps): JSX.Element {
  const bottom = climber.camera;
  const top = bottom + 320;
  const visible = platforms.filter((p) => p.y >= bottom - 12 && p.y <= top + 12);
  const marks = Array.from({ length: 9 }, (_, i) => Math.floor(bottom / 40) * 40 + i * 40);
  const foot = Math.max(2, Math.min(96, ((climber.y - bottom) / 320) * 100));
  return (
    <div className={styles.scene} role="img" aria-label={label}>
      <svg
        className={styles.world}
        viewBox="0 0 240 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {marks.map((y) => (
          <path key={y} d={`M0 ${320 - (y - bottom)}H240`} className={styles.ruler} />
        ))}
        <path d="M16 0V320M224 0V320" className={styles.margin} />
        {visible.flatMap((p) =>
          [-240, 0, 240].map((offset) => {
            const y = 320 - (p.y - bottom);
            const x = p.x + offset;
            return (
              <g key={`${p.id}:${offset}`}>
                <rect
                  x={x - p.width / 2}
                  y={y}
                  width={p.width}
                  height={5}
                  rx={2}
                  className={p.kind === 'spring' ? styles.springPlatform : styles.platform}
                />
                {p.kind === 'spring' ? (
                  <path
                    d={`M${x - 7} ${y - 3}l14 -3 -14 -3 14 -3 -14 -3h14`}
                    className={styles.spring}
                  />
                ) : null}
              </g>
            );
          }),
        )}
      </svg>
      {[-100, 0, 100].map((offset) => (
        <svg
          key={offset}
          className={styles.character}
          style={{ left: `${(climber.x / 240) * 100 + offset}%`, bottom: `${foot}%` }}
          viewBox="0 0 44 48"
          aria-hidden="true"
          data-out={climber.died !== null ? 'true' : undefined}
        >
          <path d="M12 41l-5 5m25 -5 5 5" className={styles.boots} />
          <path d="M10 13Q10 4 22 4T34 13V32Q34 43 22 43T10 32Z" className={styles.body} />
          <path d="M22 4V0m-6 1h12" className={styles.antenna} />
          <path d="M13 16Q22 11 31 16V27Q22 32 13 27Z" className={styles.visor} />
          <circle cx="18" cy="21" r="2" className={styles.eye} />
          <circle cx="26" cy="21" r="2" className={styles.eye} />
          <text x="22" y="39" textAnchor="middle" fontSize="10" className={styles.number}>
            {slot + 1}
          </text>
          {climber.died !== null ? (
            <path d="M13 13l18 18m0 -18L13 31" className={styles.cross} />
          ) : null}
        </svg>
      ))}
    </div>
  );
}
