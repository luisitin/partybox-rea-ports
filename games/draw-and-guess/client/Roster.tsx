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
  me,
}: {
  board: PublicBoard;
  players: ViewPlayer[];
  ranked?: boolean;
  gains?: boolean;
  me?: string;
}): JSX.Element {
  const L = useT(STRINGS);
  const rows = ranked
    ? [...players].sort((a, b) => (board.scores[b.id] ?? 0) - (board.scores[a.id] ?? 0))
    : players;
  return (
    <ul className={styles.rows} aria-label={L('Players and points')} data-phone={me !== undefined}>
      {rows.map((player) => {
        const drawing = player.id === board.drawer;
        const solved = board.solvedIds.includes(player.id);
        return (
          <li key={player.id} data-me={player.id === me} data-solved={solved}>
            <span
              className={styles.mark}
              aria-label={drawing ? L('Artist') : solved ? L('Solved') : L('Guessing')}
            >
              {drawing ? '✎' : solved ? '✓' : '·'}
            </span>
            <span className={styles.name} title={player.name}>
              {player.name}
            </span>
            {gains ? <span className={styles.gain}>+{board.gains[player.id] ?? 0}</span> : null}
            <b className={styles.points}>{board.scores[player.id] ?? 0}</b>
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
