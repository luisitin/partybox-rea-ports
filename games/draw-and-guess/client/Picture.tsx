import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { Stroke } from '../server/types';
import { COLORS } from './palette';
import { STRINGS } from './strings';
import styles from './Picture.module.css';

/** The shared picture is just the bounded stroke history. It never knows the secret word. */
export function Picture({ strokes }: { strokes: Stroke[] }): JSX.Element {
  const L = useT(STRINGS);
  return (
    <svg
      className={styles.picture}
      viewBox="0 0 1000 600"
      role="img"
      aria-label={L('Live drawing')}
    >
      {strokes.map((stroke, index) => {
        const color = `var(${COLORS[stroke.color]?.token ?? '--pb-text'})`;
        const first = stroke.points[0];
        return stroke.points.length === 1 && first ? (
          <circle key={index} cx={first[0]} cy={first[1]} r={stroke.width / 2} fill={color} />
        ) : (
          <polyline
            key={index}
            points={stroke.points.map((p) => p.join(',')).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

/** Original pencil and spark illustration for the word-choice beat. */
export function Pencil(): JSX.Element {
  return (
    <svg className={styles.pencil} viewBox="0 0 120 120" aria-hidden="true">
      <path d="M24 89 31 66 79 18 102 41 54 89Z" fill="var(--pb-accent-2)" />
      <path d="m79 18 8-8a9 9 0 0 1 13 0l10 10a9 9 0 0 1 0 13l-8 8Z" fill="var(--pb-accent)" />
      <path d="m24 89 7-23 23 23Z" fill="var(--pb-text-muted)" />
      <path d="m24 89 3-9 6 6Z" fill="var(--pb-bg)" />
      <path
        d="m44 76 46-46M15 34v16m-8-8h16m68 48v16m-8-8h16"
        stroke="var(--pb-info)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M19 104h61" stroke="var(--pb-text-muted)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
