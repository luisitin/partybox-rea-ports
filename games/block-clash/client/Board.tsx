// Original SVG block art; ghost outlines preview the landing without deciding any game rules.
import type { JSX } from 'react';
import type { BoardView } from '../server/types';
import { pieceCells } from '../server/pieces';
import styles from './Board.module.css';

export function Board({ board }: { board: BoardView }): JSX.Element {
  const active = board.active;
  const blocks = active ? pieceCells(active.kind, active.rotation) : [];
  return (
    <svg
      className={styles.board}
      viewBox="0 0 10 20"
      role="img"
      aria-label={`${board.name}'s board: ${board.lines} lines, ${board.alive ? 'playing' : 'out'}`}
    >
      <rect className={styles.background} width="10" height="20" />
      {Array.from({ length: 19 }, (_, y) => (
        <path key={`h${y}`} className={styles.grid} d={`M0 ${y + 1}H10`} />
      ))}
      {Array.from({ length: 9 }, (_, x) => (
        <path key={`v${x}`} className={styles.grid} d={`M${x + 1} 0V20`} />
      ))}
      {board.grid.flatMap((row, y) =>
        row.map((value, x) =>
          value ? (
            <g key={`${x}:${y}`} data-kind={value} className={styles.block}>
              <rect x={x + 0.06} y={y + 0.06} width="0.88" height="0.88" rx="0.1" />
              <path className={styles.mark} d={`M${x + 0.25} ${y + 0.35}h0.5`} />
            </g>
          ) : null,
        ),
      )}
      {active &&
        blocks.map(([x, y], i) => (
          <rect
            key={`g${i}`}
            className={styles.ghost}
            x={active.x + x + 0.08}
            y={board.ghostY + y + 0.08}
            width="0.84"
            height="0.84"
            rx="0.1"
          />
        ))}
      {active &&
        blocks.map(([x, y], i) => (
          <g key={`a${i}`} className={styles.falling}>
            <rect
              x={active.x + x + 0.06}
              y={active.y + y + 0.06}
              width="0.88"
              height="0.88"
              rx="0.1"
            />
            <path
              className={styles.mark}
              d={`M${active.x + x + 0.25} ${active.y + y + 0.35}h0.5`}
            />
          </g>
        ))}
      {!board.alive && (
        <g className={styles.out}>
          <rect x="1" y="8" width="8" height="4" rx="0.4" />
          <text x="5" y="10.6" textAnchor="middle">
            OUT
          </text>
        </g>
      )}
    </svg>
  );
}
