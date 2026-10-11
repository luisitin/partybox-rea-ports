// Public progress has shapes only. Neither a guess nor its letters reach this stage.
import type { JSX } from 'react';
import { Stage, useServerNow } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { WordGuessTvView } from '../server/index';
import { clockText, MARK_LABEL, MARK_SYMBOL, roundWinnerIds, solveTime } from './tiles';
import styles from './Tv.module.css';

export function Tv({ view }: GameTvProps<WordGuessTvView>): JSX.Element {
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const playing = view.phaseId === 'guess';
  const rows = [...view.grids].sort((a, b) =>
    playing ? 0 : (view.ranks[a.id] ?? 1) - (view.ranks[b.id] ?? 1),
  );
  const names = Object.fromEntries(view.players.map((p) => [p.id, p.name]));
  const winnerNames = rows.filter((r) => view.ranks[r.id] === 1).map((r) => names[r.id]);
  const roundWinners = roundWinnerIds(view);
  const roundHeadline =
    roundWinners.length === 1
      ? `${names[roundWinners[0]!]} wins this round!`
      : roundWinners.length > 1
        ? `${roundWinners.length} players share the round win.`
        : 'No solves this round.';
  const headline = playing
    ? 'One word. Six chances.'
    : view.phaseId === 'done'
      ? winnerNames.length === 1
        ? `${winnerNames[0]} wins!`
        : 'A tie at the top!'
      : `The word was ${view.solution?.toUpperCase() ?? '—'}`;
  return (
    <Stage className={styles.stage}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>
            Round {view.round} of {view.rounds} · Word Guess Race
          </p>
          <h2>{headline}</h2>
        </div>
        {view.deadline !== null ? (
          <div className={styles.clock} role="timer" aria-label="Time left">
            {clockText(view.deadline - now)}
          </div>
        ) : null}
      </header>
      <p className={styles.legend}>✓ Right place · ↔ Move it · × No match here</p>
      <div className={styles.players}>
        {rows.map((grid) => {
          const player = view.players.find((p) => p.id === grid.id);
          const status = grid.solved
            ? `✓ Solved in ${grid.rows.length}`
            : grid.finished
              ? `${grid.rows.length} / 6 · Not solved`
              : !player?.connected
                ? 'Reconnecting'
                : `${grid.rows.length} / 6 guesses`;
          return (
            <section className={styles.card} key={grid.id} data-solved={grid.solved}>
              <div className={styles.name}>
                <strong>{names[grid.id]}</strong>
                <span>{view.scores[grid.id] ?? 0} pts</span>
              </div>
              <div className={styles.grid} role="img" aria-label={`${names[grid.id]}: ${status}`}>
                {Array.from({ length: 6 }, (_, row) =>
                  Array.from({ length: 5 }, (_, col) => {
                    const mark = grid.rows[row]?.[col];
                    return (
                      <span
                        className={styles.tile}
                        data-mark={mark}
                        key={`${row}-${col}`}
                        aria-label={mark ? MARK_LABEL[mark] : 'empty'}
                      >
                        {mark ? MARK_SYMBOL[mark] : '·'}
                      </span>
                    );
                  }),
                )}
              </div>
              <p className={styles.status}>
                {playing
                  ? status
                  : `${view.phaseId === 'reveal' && roundWinners.includes(grid.id) ? '★ Round win · ' : ''}${grid.solved ? `${grid.rows.length} guesses · ${solveTime(grid.elapsedMs!)}` : 'Not solved'} · +${view.lastPoints[grid.id] ?? 0}`}
              </p>
            </section>
          );
        })}
      </div>
      <p className={styles.footer}>
        {playing
          ? 'Guess on your phone. Fewer guesses wins; speed breaks a tie.'
          : view.phaseId === 'done'
            ? 'Three shared words. One race.'
            : `${roundHeadline} ${view.round < view.rounds ? 'Next word starts automatically.' : 'Final standings next.'}`}
      </p>
    </Stage>
  );
}
