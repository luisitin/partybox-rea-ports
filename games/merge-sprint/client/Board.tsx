import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';
import styles from './Board.module.css';

export function Board({
  board,
  label,
  miniature = false,
  moves = 0,
}: {
  board: readonly number[];
  label: string;
  miniature?: boolean;
  moves?: number;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <div
      className={styles.board}
      role="grid"
      aria-label={label}
      aria-readonly="true"
      data-mini={miniature ? 'true' : undefined}
    >
      {[0, 1, 2, 3].map((row) => (
        <div key={row} role="row" className={styles.row}>
          {[0, 1, 2, 3].map((col) => {
            const value = board[row * 4 + col] ?? 0;
            return (
              <span
                key={`${col}:${value}`}
                className={styles.tile}
                role="gridcell"
                data-value={value}
                data-digits={String(value).length}
                data-pop={value > 0 && moves > 0 ? 'true' : undefined}
                aria-label={
                  value
                    ? L('Row {row}, column {col}: {value}', { row: row + 1, col: col + 1, value })
                    : L('Row {row}, column {col}: empty', { row: row + 1, col: col + 1 })
                }
              >
                {value || null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
