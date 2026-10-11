// Shape-coded territory and large numbered heads stay readable without relying on player colors.
import { useId } from 'react';
import type { JSX } from 'react';
import type { Direction } from '../server/types';
import { cellCenter, playerInk, territoryPaths, trailPath } from './mapMath';
import { headingTriangle, markerGeometry } from './markerGeometry';
import { OwnershipPattern } from './OwnershipPattern';
import { OWNERSHIP_TEXTURES, ownershipTexture } from './textures';
import styles from './Map.module.css';

interface MapRunner {
  id: string;
  slot: number;
  home: number;
  cell: number;
  trail: number[];
  alive: boolean;
  dir: Direction;
  movingDir?: Direction;
}

export interface MapProps {
  width: number;
  height: number;
  owners: number[];
  runners: MapRunner[];
  label: string;
  meId?: string;
  compact?: boolean;
}

export function Map({
  width,
  height,
  owners,
  runners,
  label,
  meId,
  compact = false,
}: MapProps): JSX.Element {
  const gridId = useId();
  const paths = territoryPaths(owners, width, height);
  const marker = markerGeometry(compact);
  return (
    <svg
      className={styles.map}
      viewBox={`-1.25 -1.25 ${width + 2.5} ${height + 2.5}`}
      role="img"
      aria-label={label}
      data-compact={compact || undefined}
    >
      <defs>
        <pattern id={gridId} width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0H0V1" className={styles.grid} />
        </pattern>
        {OWNERSHIP_TEXTURES.map((_, slot) => (
          <OwnershipPattern key={slot} id={`${gridId}-owner-${slot}`} slot={slot} />
        ))}
      </defs>
      <rect width={width} height={height} className={styles.ground} />
      {[...paths].map(([slot, path]) => (
        <path key={slot} d={path} fill={playerInk(slot)} className={styles.territory} />
      ))}
      {[...paths].map(([slot, path]) => (
        <path
          key={slot}
          d={path}
          fill={`url(#${gridId}-owner-${slot})`}
          data-owner={slot + 1}
          data-texture={ownershipTexture(slot).name}
        />
      ))}
      <rect width={width} height={height} fill={`url(#${gridId})`} />
      <rect width={width} height={height} className={styles.edge} />
      {runners.map((runner) => {
        const [x, y] = cellCenter(runner.home, width);
        return (
          <g key={runner.id}>
            <rect
              x={x - 1.5}
              y={y - 1.5}
              width="3"
              height="3"
              stroke={playerInk(runner.slot)}
              className={styles.home}
            />
            <text
              x={x}
              y={y}
              className={styles.homeNumber}
              data-marker="home"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {runner.slot + 1}
            </text>
          </g>
        );
      })}
      {runners
        .filter((runner) => runner.alive)
        .map((runner) => (
          <path
            key={runner.id}
            d={trailPath([...runner.trail, runner.cell], width)}
            stroke={playerInk(runner.slot)}
            className={styles.trail}
          />
        ))}
      {runners
        .filter((runner) => runner.alive)
        .sort((a, b) => Number(a.id === meId) - Number(b.id === meId))
        .map((runner) => {
          const [x, y] = cellCenter(runner.cell, width);
          const direction = runner.movingDir ?? runner.dir;
          return (
            <g key={runner.id} transform={`translate(${x} ${y})`}>
              {runner.id === meId ? <circle r={marker.ringRadius} className={styles.mine} /> : null}
              <circle
                r={marker.radius}
                fill="var(--pb-bg)"
                stroke={playerInk(runner.slot)}
                strokeWidth="0.18"
              />
              <polygon
                points={headingTriangle(direction, marker.radius)}
                className={styles.heading}
                data-heading={direction}
              />
              <text
                className={styles.number}
                textAnchor="middle"
                dominantBaseline="central"
                data-marker="runner"
              >
                {runner.slot + 1}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
