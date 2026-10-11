// A row of seat-coloured dots with one state each (T-0646): the shared way a Kaboom Scene shows who has answered, who is locked
// out and who is still working. Drawn marks, no emoji; the state is also in the label for screen readers.
import type { JSX } from 'react';
import { INK } from '../rhythm/art/Art';
import styles from './SeatDots.module.css';

export type DotState = 'idle' | 'good' | 'bad' | 'busy';

export interface SeatDotsProps {
  players: readonly { id: string; name: string; hue: number; connected: boolean }[];
  /** One state per player, in the same order. */
  states: readonly DotState[];
  /** Print each seat's name under its dot: a dot alone is only a colour (T-0902). */
  names?: boolean;
}

export function SeatDots({ players, states, names }: SeatDotsProps): JSX.Element {
  return (
    <ul className={styles.row} data-names={names === true}>
      {players.map((p, i) => {
        const st = states[i] ?? 'idle';
        return (
          <li
            key={p.id}
            className={styles.dot}
            data-state={st}
            data-away={!p.connected}
            style={{ ['--hue' as string]: p.hue }}
            aria-label={`${p.name}: ${st}`}
          >
            <svg
              viewBox="0 0 24 24"
              width="100%"
              height="100%"
              aria-hidden="true"
              focusable="false"
            >
              {st === 'good' ? (
                <path
                  d="M6 12.5 L10.5 17 L18 7.5"
                  fill="none"
                  stroke={INK}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : st === 'bad' ? (
                <path
                  d="M7 7 L17 17 M17 7 L7 17"
                  fill="none"
                  stroke={INK}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              ) : st === 'busy' ? (
                <circle cx="12" cy="12" r="3.2" fill={INK} />
              ) : null}
            </svg>
            {names === true ? (
              <span className={styles.name} aria-hidden="true">
                {p.name}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
