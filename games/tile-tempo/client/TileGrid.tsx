// Upcoming rows are scenery. Only disclosed notes may become bottom-row input targets.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import { STRINGS } from './strings';
import { visibleNotes } from './timing';
import styles from './Controller.module.css';

export function TileGrid({
  notes,
  row,
  enabled,
  tap,
}: {
  notes: readonly (number | null)[];
  row: number;
  enabled: boolean;
  tap: (column: number, row: number) => void;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <div className={styles.grid} aria-label={L('Tile grid')}>
      {visibleNotes(notes).map(({ column: note, ahead }) => (
        <div
          className={styles.tileRow}
          key={ahead}
          data-current={ahead === 0 ? 'true' : undefined}
          aria-hidden={ahead > 0 ? true : undefined}
          role={ahead === 0 ? 'group' : undefined}
          aria-label={ahead === 0 ? L('Tap this row') : undefined}
        >
          {[0, 1, 2, 3].map((column) => {
            const isNote = column === note;
            const content = note === null ? '' : isNote ? '♪' : ahead === 0 ? '×' : '';
            return ahead === 0 ? (
              <button
                className={styles.tile}
                key={column}
                type="button"
                data-note={isNote ? 'true' : undefined}
                disabled={!enabled}
                aria-label={
                  note === null
                    ? L('Waiting for the next tile')
                    : isNote
                      ? L('Note tile, column {column}', { column: column + 1 })
                      : L('Blank tile, column {column}', { column: column + 1 })
                }
                onPointerDown={(event) => {
                  if (event.button === 0) {
                    event.preventDefault();
                    tap(column, row);
                  }
                }}
                onClick={(event) => {
                  // Pointer taps already sent on press; native keyboard activation has detail 0.
                  if (event.detail === 0) tap(column, row);
                }}
              >
                <span aria-hidden="true">{content}</span>
              </button>
            ) : (
              <span className={styles.tile} key={column} data-note={isNote ? 'true' : undefined}>
                {content}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
