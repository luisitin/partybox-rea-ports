// One compact stage for spectators and for phones waiting on the next word.
import type { JSX } from 'react';
import type { WordGuessControllerView } from '../server/index';
import { MARK_SYMBOL } from './tiles';
import styles from './Controller.module.css';

export function Standings({
  view,
  grids = false,
}: {
  view: WordGuessControllerView;
  grids?: boolean;
}): JSX.Element {
  const playing = view.phaseId === 'guess';
  const rows = [...view.grids].sort((a, b) =>
    playing ? 0 : (view.ranks[a.id] ?? 1) - (view.ranks[b.id] ?? 1),
  );
  return (
    <div className={grids ? styles.race : styles.standings} aria-label="Race standings">
      {rows.map((grid) => {
        const player = view.players.find((p) => p.id === grid.id);
        return (
          <section key={grid.id} className={styles.row} data-me={grid.id === view.me.id}>
            <div className={styles.rowName}>
              <b>
                {!playing ? `#${view.ranks[grid.id]} ` : ''}
                {player?.name}
              </b>
              <span>{view.scores[grid.id] ?? 0} pts</span>
            </div>
            {grids ? (
              <div
                className={styles.miniGrid}
                role="img"
                aria-label={`${player?.name}: ${grid.rows.length} guesses`}
              >
                {Array.from({ length: 30 }, (_, i) => {
                  const mark = grid.rows[Math.floor(i / 5)]?.[i % 5];
                  return (
                    <span key={i} data-mark={mark}>
                      {mark ? MARK_SYMBOL[mark] : '·'}
                    </span>
                  );
                })}
              </div>
            ) : null}
            <small>
              {grid.solved
                ? `✓ ${grid.rows.length} guesses${!playing ? ` · ${(grid.elapsedMs! / 1000).toFixed(1)}s` : ''}`
                : grid.finished
                  ? `${grid.rows.length}/6 · Not solved`
                  : !player?.connected
                    ? 'Reconnecting'
                    : `${grid.rows.length}/6 guesses`}
              {!playing ? ` · +${view.lastPoints[grid.id] ?? 0}` : ''}
            </small>
          </section>
        );
      })}
    </div>
  );
}
