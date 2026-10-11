// A bounded SVG lets the TV, phone stage and optimistic drawer show the same public ink.
import type { JSX, PointerEvent } from 'react';
import type { Stroke } from '../server/types';
import styles from './Board.module.css';

export const INKS = [
  ['Ink', '--pb-text'],
  ['Rose', '--pb-accent'],
  ['Gold', '--pb-accent-2'],
  ['Mint', '--pb-accent-3'],
  ['Sky', '--pb-info'],
  ['Violet', '--pb-player-5'],
] as const;

interface BoardProps {
  strokes: Stroke[];
  label: string;
  editable?: boolean;
  onPointerDown?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: (event: PointerEvent<SVGSVGElement>) => void;
  onLostPointerCapture?: (event: PointerEvent<SVGSVGElement>) => void;
}

export function Board({ strokes, label, editable, ...events }: BoardProps): JSX.Element {
  return (
    <svg
      className={styles.board}
      viewBox="0 0 1000 600"
      role="img"
      aria-label={label}
      data-editable={editable || undefined}
      {...events}
    >
      {strokes.map((stroke) => {
        const ink = `var(${INKS[stroke.color]?.[1] ?? '--pb-text'})`;
        const first = stroke.points[0];
        return stroke.points.length === 1 && first ? (
          <circle key={stroke.seq} cx={first[0]} cy={first[1]} r={stroke.size / 2} fill={ink} />
        ) : (
          <polyline
            key={stroke.seq}
            points={stroke.points.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={ink}
            strokeWidth={stroke.size}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
