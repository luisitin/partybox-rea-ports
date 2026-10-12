// Received poses and the personal camera move together; there is no client physics.
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { ViewPlayer } from '@partybox/game-sdk/ui';
import { radius } from '../server/geometry';
import type { ArenaView, MatchView } from '../server/index';
import { cameraTransform, cellName, cellNameSize, playerCamera } from './camera';
import { playerStyle } from './display';
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
  follow?: boolean;
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
  follow,
}: ArenaProps): JSX.Element {
  const L = useT(STRINGS);
  const arena = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState({ width: 362, height: 420 });
  const clipId = useId();
  const gridId = useId();
  useLayoutEffect(() => {
    const element = arena.current;
    if (!element || !follow || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width < 1 || height < 1) return;
      setViewport((current) =>
        Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
          ? current
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [follow]);
  const camera = follow ? playerCamera(cells, mine, viewport) : null;
  const names = Object.fromEntries(players.map((player) => [player.id, player.name]));
  const orderedCells = [...cells].sort((a, b) => radius(a.mass) - radius(b.mass) || a.id - b.id);
  const pose = (cell: { owner: string; x: number; y: number }): CSSProperties => ({
    ...playerStyle(slots[cell.owner] ?? 0),
    transform: `translate(${cell.x}px, ${cell.y}px)`,
  });
  const title = (cell: { owner: string; mass: number }): string =>
    `${L('{name}, blob {slot}, {mass} mass', {
      name: names[cell.owner] ?? '',
      slot: (slots[cell.owner] ?? 0) + 1,
      mass: Math.floor(cell.mass),
    })}${cell.owner === mine ? ` · ${L('Your blob')}` : ''}`;
  return (
    <svg
      ref={arena}
      className={styles.arena}
      viewBox={camera ? `0 0 ${viewport.width} ${viewport.height}` : '0 0 160 100'}
      preserveAspectRatio={camera ? 'xMidYMid slice' : 'xMidYMid meet'}
      role="img"
      aria-label={L('Shared arena: {n} blobs and {m} snacks', {
        n: cells.length,
        m: pellets.length,
      })}
      data-arena="true"
      data-camera={camera ? 'personal' : 'overview'}
      data-camera-clipping={camera ? 'intentional player viewport' : undefined}
      data-camera-center={camera ? `${camera.x} ${camera.y}` : undefined}
      data-camera-zoom={camera?.zoom}
      data-frozen={frozen ? 'true' : undefined}
      data-phone={phone ? 'true' : undefined}
      data-compact={compact ? 'true' : undefined}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width="160" height="100" />
        </clipPath>
        <pattern id={gridId} width="2.75" height="2.75" patternUnits="userSpaceOnUse">
          <path className={styles.grid} d="M2.75 0H0V2.75" />
        </pattern>
      </defs>
      <g
        className={styles.world}
        style={camera ? { transform: cameraTransform(camera) } : undefined}
        data-world-layer="true"
        data-intentional-clipping={camera ? 'player-camera' : undefined}
      >
        <rect className={styles.worldBounds} width="160" height="100" />
        <g clipPath={`url(#${clipId})`}>
          <rect width="160" height="100" fill={`url(#${gridId})`} />
          {pellets.map((pellet) => (
            <circle
              key={pellet.id}
              className={styles.snack}
              data-snack-id={pellet.id}
              cx={pellet.x}
              cy={pellet.y}
              r="0.6"
              style={playerStyle(pellet.id % 8)}
            />
          ))}
          {orderedCells.map((cell) => {
            const cellRadius = radius(cell.mass);
            const name = names[cell.owner] ?? '';
            return (
              <g
                key={cell.id}
                data-cell-id={cell.id}
                data-pose-cell={cell.id}
                data-pose-layer="cell"
                className={`${styles.cell} ${styles.pose}`}
                style={pose(cell)}
                data-mine={cell.owner === mine ? 'true' : undefined}
              >
                <title>{title(cell)}</title>
                {cell.shieldUntil > checked ? (
                  <circle
                    className={styles.shield}
                    r={cellRadius + 0.9}
                    style={{ ['r' as string]: `${cellRadius + 0.9}px` }}
                  />
                ) : null}
                <circle
                  className={styles.body}
                  data-cell-body="true"
                  r={cellRadius}
                  style={{ ['r' as string]: `${cellRadius}px` }}
                />
                {/* Each name travels with its body, allowing larger foreground cells to occlude both. */}
                <text
                  className={styles.name}
                  data-name-owner={cell.owner}
                  data-cell-label-id={cell.id}
                  data-name-inside="true"
                  fontSize={cellNameSize(cellRadius)}
                  x="0"
                  y="0"
                >
                  {cellName(name, cellRadius)}
                </text>
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
}
