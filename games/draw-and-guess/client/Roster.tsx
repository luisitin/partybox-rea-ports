import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { ViewPlayer } from '@partybox/game-sdk/ui';
import type { PublicBoard } from '../server/types';
import { STRINGS } from './strings';
import styles from './Roster.module.css';

export function Roster({
  board,
  players,
  ranked = false,
  gains = false,
  final = false,
  me,
}: {
  board: PublicBoard;
  players: ViewPlayer[];
  ranked?: boolean;
  gains?: boolean;
  final?: boolean;
  me?: string;
}): JSX.Element {
  const L = useT(STRINGS);
  const rows =
    ranked || final
      ? [...players].sort((a, b) => (board.scores[b.id] ?? 0) - (board.scores[a.id] ?? 0))
      : players;
  const top = Math.max(0, ...players.map((player) => board.scores[player.id] ?? 0));
  const tied = players.filter((player) => (board.scores[player.id] ?? 0) === top).length > 1;
  return (
    <ul
      className={styles.rows}
      aria-label={final ? L('Final standings') : L('Players and points')}
      data-phone={me !== undefined}
      data-final={final}
    >
      {rows.map((player) => {
        const drawing = player.id === board.drawer;
        const solved = board.solvedIds.includes(player.id);
        const offline = !final && !player.connected;
        const score = board.scores[player.id] ?? 0;
        const rank = 1 + players.filter((other) => (board.scores[other.id] ?? 0) > score).length;
        const winner = final && score === top;
        const winnerLabel = tied ? L('Joint winner') : L('Winner');
        return (
          <li
            key={player.id}
            data-me={player.id === me}
            data-solved={!final && solved}
            data-winner={winner}
            data-offline={offline}
          >
            <span
              className={styles.mark}
              role="img"
              aria-label={
                final
                  ? winner
                    ? L('{result}, place {n}', { result: winnerLabel, n: rank })
                    : L('Place {n}', { n: rank })
                  : offline
                    ? drawing
                      ? L('Artist · Offline')
                      : solved
                        ? L('Solved · Offline')
                        : L('Offline')
                    : drawing
                      ? L('Artist')
                      : solved
                        ? L('Solved')
                        : L('Guessing')
              }
            >
              {final ? (winner ? '★' : rank) : drawing ? '✎' : solved ? '✓' : offline ? '○' : '·'}
            </span>
            <span className={styles.identity}>
              <span className={styles.name} title={player.name}>
                {player.name}
              </span>
              {offline ? <span aria-hidden="true">{L('Offline')}</span> : null}
              {winner ? (
                <span className={styles.winnerLabel} aria-hidden="true">
                  {winnerLabel}
                </span>
              ) : null}
            </span>
            {gains && !final ? (
              <span className={styles.gain}>+{board.gains[player.id] ?? 0}</span>
            ) : null}
            <b className={styles.points}>{score}</b>
          </li>
        );
      })}
    </ul>
  );
}

export function leaderNames(board: PublicBoard, players: ViewPlayer[]): string[] {
  const top = Math.max(0, ...players.map((p) => board.scores[p.id] ?? 0));
  return players.filter((p) => (board.scores[p.id] ?? 0) === top).map((p) => p.name);
}
