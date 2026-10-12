// One public SVG stage. Received poses are eased, never predicted or simulated here.
import type { CSSProperties, JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import { radius } from '../server/geometry';
import type { ArenaView, MatchView } from '../server/index';
import type { ViewPlayer } from '@partybox/game-sdk/ui';
import { playerStyle } from './display';
import { placeLabels } from './labels';
import { STRINGS } from './strings';
import styles from './Arena.module.css';

export interface ArenaProps extends ArenaView {
  players: ViewPlayer[];
  slots: MatchView['slots'];
  checked: number;
  mine?: string;
  frozen?: boolean;
  phone?: boolean;
  compact?: boolean;
}

export function Arena({
  cells,
  pellets,
  players,
  slots,
  checked,
  mine,
  frozen,
  phone,
  compact,
}: ArenaProps): JSX.Element {
  const L = useT(STRINGS);
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const largest = new Map<string, number>();
  for (const cell of cells) {
    const old = cells.find((c) => c.id === largest.get(cell.owner));
    if (!old || cell.mass > old.mass) largest.set(cell.owner, cell.id);
  }
  // The compact phone board is 220px wide inside its border; live is 362px.
  const numberSize = phone ? (compact ? 12 : 7.2) : 4.2;
  const plateRadius = numberSize * 0.65;
  const numbers = placeLabels(cells, plateRadius * 2, plateRadius * 2);
  const numberById = new Map(numbers.map((label) => [label.id, label]));
  const nameSize = phone ? 6.4 : 4.2;
  const nameWidth = phone ? 36 : 30,
    nameHeight = phone ? 8.6 : 6.2;
  const nameCells =
    phone && compact ? [] : cells.filter((cell) => largest.get(cell.owner) === cell.id);
  const tags = placeLabels(
    nameCells.map((cell) => ({
      id: cell.id,
      x: cell.x,
      y: cell.y + (cell.y < 15 ? radius(cell.mass) + 5 : -radius(cell.mass) - 3),
    })),
    nameWidth,
    nameHeight,
    numbers,
  );
  const tagById = new Map(tags.map((label) => [label.id, label]));
  const pose = (cell: { owner: string; x: number; y: number }): CSSProperties => ({
    ...playerStyle(slots[cell.owner] ?? 0),
    transform: `translate(${cell.x}px, ${cell.y}px)`,
  });
  const title = (cell: { owner: string; mass: number }): string =>
    L('{name}, blob {slot}, {mass} mass', {
      name: names[cell.owner] ?? '',
      slot: (slots[cell.owner] ?? 0) + 1,
      mass: Math.floor(cell.mass),
    });
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
      data-phone={phone ? 'true' : undefined}
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
        return (
          <g
            key={cell.id}
            data-cell-id={cell.id}
            data-pose-cell={cell.id}
            data-pose-layer="body"
            className={`${styles.cell} ${styles.pose}`}
            style={pose(cell)}
            data-mine={cell.owner === mine ? 'true' : undefined}
          >
            <title>{title(cell)}</title>
            {cell.shieldUntil > checked ? <circle className={styles.shield} r={r + 0.9} /> : null}
            <circle className={styles.body} r={r} />
            <path
              className={styles.shine}
              d={`M${-r * 0.55} ${-r * 0.2}Q${-r * 0.6} ${-r * 0.7} ${-r * 0.05} ${-r * 0.68}`}
            />
          </g>
        );
      })}
      {nameCells.map((cell) => {
        const tag = tagById.get(cell.id)!;
        const name = names[cell.owner] ?? '';
        return (
          <g key={cell.id} data-name-owner={cell.owner} style={playerStyle(slots[cell.owner] ?? 0)}>
            <title>{name}</title>
            <line className={styles.leader} x1={cell.x} y1={cell.y} x2={tag.x} y2={tag.y} />
            <g transform={`translate(${tag.x} ${tag.y})`}>
              <rect
                className={styles.tag}
                x={-nameWidth / 2}
                y={-nameHeight / 2}
                width={nameWidth}
                height={nameHeight}
                rx="2"
              />
              <text className={styles.name} fontSize={nameSize}>
                {name.length > 9 ? `${name.slice(0, 8)}…` : name}
              </text>
            </g>
          </g>
        );
      })}
      {/* All contrast plates precede all digits, including when pieces share a pose. */}
      {cells.map((cell) => {
        const label = numberById.get(cell.id)!;
        return (
          <g
            key={cell.id}
            className={styles.pose}
            data-pose-cell={cell.id}
            data-pose-layer="plate"
            style={pose(cell)}
            data-mine={cell.owner === mine ? 'true' : undefined}
          >
            <line
              className={styles.leader}
              x1="0"
              y1="0"
              x2={label.x - cell.x}
              y2={label.y - cell.y}
            />
            <circle
              className={styles.numberPlate}
              data-cell-label-backplate={cell.id}
              cx={label.x - cell.x}
              cy={label.y - cell.y}
              r={plateRadius}
            />
          </g>
        );
      })}
      {cells.map((cell) => {
        const label = numberById.get(cell.id)!;
        return (
          <g
            key={cell.id}
            className={styles.pose}
            data-pose-cell={cell.id}
            data-pose-layer="number"
            style={pose(cell)}
          >
            <title>{`${title(cell)}${cell.owner === mine ? ` · ${L('Your blob')}` : ''}`}</title>
            <text
              data-cell-label-id={cell.id}
              className={styles.number}
              fontSize={numberSize}
              x={label.x - cell.x}
              y={label.y - cell.y + 0.2}
            >
              {(slots[cell.owner] ?? 0) + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
