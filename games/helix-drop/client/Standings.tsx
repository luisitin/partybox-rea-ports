// Small shared public ranking for phone-only rooms and results.
import type { JSX } from 'react';
import type { ViewPlayer } from '@partybox/game-sdk';
import { slotStyle } from './Tower';
import styles from './Controller.module.css';

export function Standings({
  players,
  scores,
  me,
}: {
  players: ViewPlayer[];
  scores: Record<string, number>;
  me: string;
}): JSX.Element {
  return (
    <ol className={styles.standings} aria-label="Depth standings">
      {players
        .map((p, i) => ({ ...p, slot: i }))
        .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
        .map((p) => (
          <li key={p.id} data-me={p.id === me || undefined} style={slotStyle(p.slot)}>
            <span className={styles.mark} aria-hidden="true">
              ●
            </span>
            <b>{p.name}</b>
            <span>{scores[p.id] ?? 0} floors</span>
          </li>
        ))}
    </ol>
  );
}
