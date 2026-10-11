import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { Tower } from '../server/types';
import { seatStyle, slotOf } from './display';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

interface RosterProps {
  players: { id: string; name: string }[];
  scores: Record<string, number>;
  slots: Record<string, number>;
  towers?: Tower[];
  mine: string;
  ranked?: boolean;
}

export function Roster({
  players,
  scores,
  slots,
  towers,
  mine,
  ranked = false,
}: RosterProps): JSX.Element {
  const L = useT(STRINGS);
  const rows = players.map((p) => ({
    ...p,
    slot: slotOf(slots, p.id),
    best: scores[p.id] ?? 0,
    height: towers?.find((t) => t.id === p.id)?.height ?? null,
  }));
  const ordered = ranked ? [...rows].sort((a, b) => b.best - a.best || a.slot - b.slot) : rows;
  return (
    <ol
      className={ranked ? styles.standings : styles.roster}
      aria-label={ranked ? L('Final standings') : L('Live best heights')}
    >
      {ordered.map((p) => (
        <li key={p.id} style={seatStyle(p.slot)} data-me={p.id === mine || undefined}>
          <span className={styles.seat}>
            {ranked ? 1 + rows.filter((r) => r.best > p.best).length : p.slot + 1}
          </span>
          <span className={styles.playerName}>{p.name}</span>
          <strong className={styles.rosterBest}>{p.best}</strong>
        </li>
      ))}
    </ol>
  );
}
