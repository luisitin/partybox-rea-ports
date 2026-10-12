import type { JSX } from 'react';
import { useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { ControllerMergeView } from '../server/types';
import { Board } from './Board';
import { clockText, playerColor, ranked } from './presentation';
import { STRINGS } from './strings';
import styles from './RaceStage.module.css';

/** Full stage for spectators, and the complete ranking after the race on every phone. */
export function RaceStage({
  view,
  phoneOnly,
}: Pick<GameControllerProps<ControllerMergeView>, 'view'> & { phoneOnly: boolean }): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const playing = view.phaseId === 'play';
  const names = Object.fromEntries(view.players.map((p) => [p.id, p.name]));
  const away = new Set(view.players.filter((p) => !p.connected).map((p) => p.id));
  // Keep each public board in its seat while the race runs; rank only the reveal.
  const rows = playing ? view.racers : ranked(view.racers);
  const winner = view.winners[0];
  const headline = playing
    ? L('2048')
    : view.winners.length > 1
      ? L('A tie at the top!')
      : L('{name} wins!', { name: names[winner ?? ''] ?? L('The race') });
  const reason =
    view.reason === 'target'
      ? L('{target} reached!', { target: view.target })
      : view.reason === 'clock'
        ? L('Time is up. Highest score wins.')
        : view.reason === 'blocked'
          ? L('No moves remain. Highest score wins.')
          : L('Final standings');

  return (
    <div className={styles.stage} data-play={playing || undefined}>
      <header className={styles.header}>
        <h2>{headline}</h2>
        <p>
          {playing
            ? view.paused
              ? L('Paused')
              : L('Race to {target} · {clock} left', {
                  target: view.target,
                  clock: view.deadline === null ? '—' : clockText(view.deadline - now),
                })
            : reason}
        </p>
        {playing && view.mine?.status === 'blocked' ? (
          <strong className={styles.personal}>
            {L('No moves left · Your {score} points stay in the race.', { score: view.mine.score })}
          </strong>
        ) : null}
        {!playing && view.mine ? (
          <strong className={styles.personal}>
            {view.winners.includes(view.me.id)
              ? L('You won! · {score} points', { score: view.mine.score })
              : L('You finished #{rank} · {score} points', {
                  rank: view.mine.rank,
                  score: view.mine.score,
                })}
          </strong>
        ) : null}
      </header>
      {playing ? (
        <div className={styles.boards} aria-label={L('Race boards')}>
          {rows.map((racer) => (
            <article className={styles.racer} key={racer.id}>
              <h3>
                <span>#{racer.rank}</span> {names[racer.id] ?? racer.id}
              </h3>
              <div className={styles.boardSlot}>
                <Board
                  board={racer.board}
                  miniature
                  label={L('{name}’s board', { name: names[racer.id] ?? racer.id })}
                />
              </div>
              <p>
                <strong>{racer.best}</strong> · {L('{score} pts', { score: racer.score })}
                {racer.bot ? ` · ${L('Bot')}` : away.has(racer.id) ? ` · ${L('Away')}` : ''}
                {racer.status === 'blocked' ? ` · ${L('No moves')}` : ''}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <ol className={styles.rows} aria-label={L('Final standings')}>
          {rows.map((racer) => (
            <li
              key={racer.id}
              style={playerColor(view.racers.findIndex((r) => r.id === racer.id))}
              data-me={racer.id === view.me.id || undefined}
              data-winner={view.winners.includes(racer.id) || undefined}
            >
              <b className={styles.rank}>#{racer.rank}</b>
              <div className={styles.player}>
                <strong>{names[racer.id] ?? racer.id}</strong>
                <span>
                  {L('Best tile {tile}', { tile: racer.best })}
                  {racer.bot ? ` · ${L('Bot')}` : ''}
                </span>
              </div>
              <strong className={styles.score}>{racer.score}</strong>
              {view.winners.includes(racer.id) ? (
                <span className={styles.star} aria-label={L('Winner')}>
                  ★
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <p className={styles.footer}>
        {playing
          ? phoneOnly
            ? L('Same tiles for every racer. First to the target wins.')
            : L('Watching the race. First to the target wins.')
          : view.reason === 'target'
            ? L('First to {target} wins. Reaching the target beats merge score.', {
                target: view.target,
              })
            : L('Equal scores share a place.')}
      </p>
    </div>
  );
}
