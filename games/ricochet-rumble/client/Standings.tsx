// One public seat list on both surfaces; tank numbers, OUT and disconnected words never rely on colour.
import type { CSSProperties, JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { RicochetRumbleTvView } from '../server/index';
import { STRINGS } from './strings';
import { playerColor } from './timing';
import styles from './Standings.module.css';

interface StandingsProps {
  view: RicochetRumbleTvView;
  me?: string;
  compact?: boolean;
}

export function Standings({ view, me, compact }: StandingsProps): JSX.Element {
  const L = useT(STRINGS);
  const ranked = view.phaseId === 'score' || view.phaseId === 'done';
  const tanks = new Map(view.arena.tanks.map((tank) => [tank.id, tank]));
  const rows = view.players.map((player) => ({
    ...player,
    slot: view.slots[player.id] ?? 0,
    tank: tanks.get(player.id),
  }));
  if (ranked)
    rows.sort((a, b) => (view.scores[b.id] ?? 0) - (view.scores[a.id] ?? 0) || a.slot - b.slot);
  return (
    <ol
      className={styles.rows}
      aria-label={ranked ? L('Standings') : L('Tanks')}
      data-ranked={ranked || undefined}
      data-compact={compact || undefined}
    >
      {rows.map((player) => {
        const total = view.scores[player.id] ?? 0;
        const rank = 1 + rows.filter((row) => (view.scores[row.id] ?? 0) > total).length;
        const departed = !player.tank;
        const out = view.phaseId === 'play' && !player.tank?.alive;
        return (
          <li
            key={player.id}
            style={{ ['--tank-color' as string]: playerColor(player.slot) } as CSSProperties}
            data-me={player.id === me || undefined}
            data-winner={view.winnerIds.includes(player.id) || undefined}
            data-out={departed || out || undefined}
          >
            <span className={styles.badge} aria-label={L('Tank {n}', { n: player.slot + 1 })}>
              {player.slot + 1}
            </span>
            <span className={styles.identity}>
              <b className={styles.name}>{player.name}</b>
              {departed || out || player.connected === false ? (
                <span className={styles.state}>
                  {departed ? L('Left') : out ? L('× Out') : L('Offline')}
                </span>
              ) : null}
            </span>
            <span className={styles.score}>
              {ranked ? <span className={styles.rank}>{L('#{n}', { n: rank })}</span> : null}
              <b>{total}</b>
              {view.phaseId === 'score' && (view.lastPoints[player.id] ?? 0) > 0 ? (
                <span className={styles.gain}>
                  {L('+{n}', { n: view.lastPoints[player.id] ?? 0 })}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
