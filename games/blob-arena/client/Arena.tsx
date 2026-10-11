// One public SVG stage on both devices. Positions, growth and swallowing come only from the server.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import { radius } from '../server/geometry';
import type { ArenaView, MatchView } from '../server/index';
import type { ViewPlayer } from '@partybox/game-sdk/ui';
import { playerStyle } from './display';
import { STRINGS } from './strings';
import styles from './Arena.module.css';

export interface ArenaProps extends ArenaView {
  players: ViewPlayer[];
  slots: MatchView['slots'];
  checked: number;
  mine?: string;
  frozen?: boolean;
}

export function Arena({
  cells,
  pellets,
  players,
  slots,
  checked,
  mine,
  frozen,
}: ArenaProps): JSX.Element {
  const L = useT(STRINGS);
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const largest = new Map<string, number>();
  for (const cell of cells) {
    const old = cells.find((c) => c.id === largest.get(cell.owner));
    if (!old || cell.mass > old.mass) largest.set(cell.owner, cell.id);
  }
  return (
    <svg
      className={styles.arena}
      viewBox="0 0 160 100"
      role="img"
      aria-label={L('Shared arena: {n} blobs and {m} snacks', {
        n: cells.length,
        m: pellets.length,
      })}
      data-frozen={frozen ? 'true' : undefined}
    >
      <path
        className={styles.grid}
        d="M20 0V100 M40 0V100 M60 0V100 M80 0V100 M100 0V100 M120 0V100 M140 0V100 M0 20H160 M0 40H160 M0 60H160 M0 80H160"
      />
      {pellets.map((p) => (
        <g
          key={p.id}
          className={styles.snack}
          data-snack-id={p.id}
          transform={`translate(${p.x} ${p.y})`}
        >
          {p.id % 3 === 0 ? (
            <path d="M0 -0.85 0.85 0 0 0.85 -0.85 0Z" />
          ) : (
            <circle r={p.id % 3 === 1 ? 0.6 : 0.8} />
          )}
        </g>
      ))}
      {cells.map((cell) => {
        const r = radius(cell.mass);
        const slot = slots[cell.owner] ?? 0;
        const name = names[cell.owner] ?? '';
        return (
          <g
            key={cell.id}
            data-cell-id={cell.id}
            className={styles.cell}
            transform={`translate(${cell.x} ${cell.y})`}
            style={playerStyle(slot)}
            data-mine={cell.owner === mine ? 'true' : undefined}
          >
            <title>
              {L('{name}, blob {slot}, {mass} mass', {
                name,
                slot: slot + 1,
                mass: Math.floor(cell.mass),
              })}
            </title>
            {cell.shieldUntil > checked ? <circle className={styles.shield} r={r + 0.9} /> : null}
            <circle className={styles.body} r={r} />
            <path
              className={styles.shine}
              d={`M${-r * 0.55} ${-r * 0.2}Q${-r * 0.6} ${-r * 0.7} ${-r * 0.05} ${-r * 0.68}`}
            />
          </g>
        );
      })}
      {/* Labels sit above every body, so a later, larger cell cannot conceal a seat's identity. */}
      {cells
        .filter((cell) => largest.get(cell.owner) === cell.id)
        .map((cell) => {
          const r = radius(cell.mass);
          const name = names[cell.owner] ?? '';
          const shortName = name.length > 9 ? `${name.slice(0, 8)}…` : name;
          // Clamp the name tag to the board independently of the cell's visible collision circle.
          const x = Math.max(15, Math.min(145, cell.x));
          const y = Math.max(3.1, Math.min(96.9, cell.y + (cell.y < 15 ? r + 5 : -r - 3)));
          return (
            <g
              key={cell.id}
              data-name-owner={cell.owner}
              transform={`translate(${x} ${y})`}
              style={playerStyle(slots[cell.owner] ?? 0)}
            >
              <rect className={styles.tag} x="-15" y="-3.1" width="30" height="6.2" rx="2" />
              <text className={styles.name} fontSize="4.2">
                {shortName}
              </text>
            </g>
          );
        })}
      {cells.map((cell) => (
        <text
          key={cell.id}
          data-cell-label-id={cell.id}
          className={styles.number}
          fontSize="4.2"
          x={cell.x}
          y={cell.y + 0.2}
          style={playerStyle(slots[cell.owner] ?? 0)}
        >
          {(slots[cell.owner] ?? 0) + 1}
        </text>
      ))}
    </svg>
  );
}
