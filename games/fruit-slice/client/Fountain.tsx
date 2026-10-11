// Original fruit silhouettes. The phone renders exact judged positions, including while held.
import type { JSX } from 'react';
import type { Point, Target } from '../server/types';
import styles from './Fountain.module.css';

export const FRUIT_NAMES = ['Apple', 'Orange', 'Pear', 'Melon'] as const;

export function FruitArt({ kind, bomb }: { kind: number; bomb: boolean }): JSX.Element {
  if (bomb)
    return (
      <g className={styles.bomb}>
        <path d="M2-6 3-9 6-9" className={styles.fuse} />
        <circle r="6.5" />
        <path d="m-2.6-2.6 5.2 5.2m0-5.2-5.2 5.2" className={styles.cross} />
      </g>
    );
  if (kind === 1)
    return (
      <g className={styles.orange}>
        <circle r="6.5" />
        <path d="M0-5.8q1-4 4-3-1 3-4 3" className={styles.leaf} />
        <path d="M-3-3h.1M0-4h.1M3-2h.1M-4 0h.1M2 3h.1" className={styles.detail} />
      </g>
    );
  if (kind === 2)
    return (
      <g className={styles.pear}>
        <path d="M0-6c3 0 2 2 4 4 5 6 1 9-4 9s-9-3-4-9c2-2 1-4 4-4Z" />
        <path d="M0-6v-3m0 2q3-3 4-1-1 2-4 1" className={styles.leaf} />
        <path d="M-3 1q-2 3 0 4" className={styles.detail} />
      </g>
    );
  if (kind === 3)
    return (
      <g className={styles.melon}>
        <circle r="6.5" />
        <path d="M-3-5.7Q-6 0-3 5.7M0-6.5Q-2 0 0 6.5M3-5.7Q6 0 3 5.7" className={styles.stripe} />
      </g>
    );
  return (
    <g className={styles.apple}>
      <path d="M0-5q-6-4-7 2c-1 6 3 10 7 8 4 2 8-2 7-8Q6-9 0-5Z" />
      <path d="M0-5v-4m0 1q3-4 5-2-1 3-5 3" className={styles.leaf} />
      <path d="M-4-2q-2 2-1 4" className={styles.detail} />
    </g>
  );
}

export interface FountainProps {
  targets: Target[];
  trail?: Point[];
  label: string;
  numbered?: boolean;
  animated?: boolean;
}

export function Fountain({
  targets,
  trail = [],
  label,
  numbered = false,
  animated = false,
}: FountainProps): JSX.Element {
  let number = 0;
  return (
    <svg
      viewBox="0 0 100 100"
      className={styles.fountain}
      role="img"
      aria-label={label}
      data-animated={animated ? 'true' : undefined}
    >
      <path d="M8 96q42-8 84 0" className={styles.rim} />
      {targets.map((target) => (
        <g
          key={target.id}
          className={styles.target}
          transform={`translate(${target.x} ${target.y})`}
        >
          <FruitArt kind={target.kind} bomb={target.bomb} />
          {numbered && !target.bomb ? (
            <text y="1.5" className={styles.number}>
              {++number}
            </text>
          ) : null}
        </g>
      ))}
      {trail.length > 1 ? (
        <polyline
          points={trail.map((point) => `${point.x},${point.y}`).join(' ')}
          className={styles.trail}
        />
      ) : null}
    </svg>
  );
}
