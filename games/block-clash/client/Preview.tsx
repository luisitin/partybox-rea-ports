import type { JSX } from 'react';
import type { PieceKind } from '../server/types';
import { pieceCells } from '../server/pieces';
import styles from './Controller.module.css';

export function Preview({ kind }: { kind: PieceKind | null }): JSX.Element {
  return (
    <svg viewBox="0 0 4 4" className={styles.preview} role="img" aria-label={kind ?? 'Empty hold'}>
      {kind &&
        pieceCells(kind, 0).map(([x, y], i) => (
          <rect key={i} x={x + 0.07} y={y + 0.07} width="0.86" height="0.86" rx="0.12" />
        ))}
      {!kind && (
        <text x="2" y="2.6" textAnchor="middle">
          —
        </text>
      )}
    </svg>
  );
}
