// Shape-coded territory and large numbered heads stay readable without relying on player colors.
import { useId } from 'react';
import type { JSX } from 'react';
import type { Direction } from '../server/types';
import { cellCenter, playerInk, territoryPaths, trailPath } from './mapMath';
import { headingTriangle, markerGeometry } from './markerGeometry';
import { homeLabelPositions } from './homeLabels';
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

// Short trails stay attached to their numbered head; long trails get sparse owner pins.
export function trailMarkerCells(
  trail: readonly number[],
  head: number,
  width: number,
  avoidCells: readonly number[] = [],
): number[] {
  if (width < 1 || trail.length < 4) return [];
  const [headX, headY] = cellCenter(head, width);
  const spacing = Math.max(8, Math.ceil(trail.length / 8));
  const selected: number[] = [];
  let lastIndex = -8;
  for (let start = 0; start < trail.length; start += spacing) {
    const end = Math.min(start + spacing, trail.length);
    // Search forward inside each sparse bucket so nearby seats get staggered labels.
    for (let index = Math.max(start, lastIndex + 8); index < end; index++) {
      const cell = trail[index];
      if (cell === undefined) continue;
      const [x, y] = cellCenter(cell, width);
      if (Math.hypot(x - headX, y - headY) < 2.5) continue;
      if (
        [...avoidCells, ...selected].some((other) => {
          const [otherX, otherY] = cellCenter(other, width);
          return Math.hypot(x - otherX, y - otherY) < 2.5;
        })
      )
        continue;
      selected.push(cell);
      lastIndex = index;
      break;
    }
  }
  return selected;
}

export interface TrailOwnerMarker {
  id: string;
  slot: number;
  cell: number;
}

export function trailOwnerMarkers(
  runners: readonly MapRunner[],
  width: number,
): TrailOwnerMarker[] {
  const alive = runners.filter((runner) => runner.alive).sort((a, b) => a.slot - b.slot);
  const heads = alive.map((runner) => runner.cell);
  const reserved: number[] = [];
  const markers: TrailOwnerMarker[] = [];
  for (const runner of alive) {
    const cells = trailMarkerCells(runner.trail, runner.cell, width, [...heads, ...reserved]);
    for (const cell of cells) markers.push({ id: runner.id, slot: runner.slot, cell });
    reserved.push(...cells);
  }
  return markers;
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
  const trailPins = trailOwnerMarkers(runners, width);
  const homeLabels = homeLabelPositions(
    runners,
    width,
    height,
    trailPins.map((pin) => pin.cell),
  );
  const heads = runners
    .filter((runner) => runner.alive)
    .sort((a, b) => Number(a.id === meId) - Number(b.id === meId));
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
        const label = homeLabels.get(runner.id);
        const displaced = label && (label[0] !== x || label[1] !== y);
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
            {displaced ? (
              <line
                x1={x}
                y1={y}
                x2={label[0]}
                y2={label[1]}
                className={styles.homeLink}
                data-home-link={runner.slot + 1}
              />
            ) : null}
            {label ? (
              <text
                x={label[0]}
                y={label[1]}
                className={styles.homeNumber}
                data-marker="home"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {runner.slot + 1}
              </text>
            ) : null}
          </g>
        );
      })}
      {runners
        .filter((runner) => runner.alive && runner.trail.length > 0)
        .map((runner) => {
          const path = trailPath([...runner.trail, runner.cell], width);
          const mine = runner.id === meId;
          return (
            <g key={runner.id}>
              {mine ? (
                <path d={path} className={styles.trailUnder} data-trail-outline={runner.slot + 1} />
              ) : null}
              <path
                d={path}
                stroke={playerInk(runner.slot)}
                className={styles.trail}
                data-mine={mine || undefined}
                data-trail={runner.slot + 1}
              />
            </g>
          );
        })}
      {trailPins.map(({ id, slot, cell }) => {
        const [x, y] = cellCenter(cell, width);
        return (
          <g
            key={`${id}-${cell}`}
            transform={`translate(${x} ${y})`}
            data-trail-owner={slot + 1}
            data-trail-cell={cell}
          >
            <polygon
              points="0,-0.72 0.72,0 0,0.72 -0.72,0"
              className={styles.trailBadge}
              data-trail-shape="diamond"
            />
            <text
              className={styles.trailNumber}
              textAnchor="middle"
              dominantBaseline="central"
              data-marker="trail"
            >
              {slot + 1}
            </text>
          </g>
        );
      })}
      {heads.map((runner) => {
        const [x, y] = cellCenter(runner.cell, width);
        return (
          <g
            key={runner.id}
            transform={`translate(${x} ${y})`}
            data-head-layer="background"
            data-head-owner={runner.slot + 1}
          >
            <circle
              r={marker.radius}
              fill="var(--pb-bg)"
              stroke={playerInk(runner.slot)}
              strokeWidth="0.18"
            />
          </g>
        );
      })}
      {heads
        .filter((runner) => runner.id === meId)
        .map((runner) => {
          const [x, y] = cellCenter(runner.cell, width);
          return (
            <circle
              key={runner.id}
              cx={x}
              cy={y}
              r={marker.ringRadius}
              className={styles.mine}
              data-head-layer="highlight"
              data-head-owner={runner.slot + 1}
            />
          );
        })}
      {heads.map((runner) => {
        const [x, y] = cellCenter(runner.cell, width);
        const direction = runner.movingDir ?? runner.dir;
        return (
          <g
            key={runner.id}
            transform={`translate(${x} ${y})`}
            data-head-layer="heading"
            data-head-owner={runner.slot + 1}
          >
            <polygon
              points={headingTriangle(direction, marker.radius)}
              className={styles.heading}
              data-heading={direction}
            />
          </g>
        );
      })}
      {heads.map((runner) => {
        const [x, y] = cellCenter(runner.cell, width);
        return (
          <g
            key={runner.id}
            transform={`translate(${x} ${y})`}
            data-head-layer="label"
            data-head-owner={runner.slot + 1}
          >
            <text
              className={styles.number}
              textAnchor="middle"
              dominantBaseline="central"
              data-marker="runner"
              stroke="var(--pb-bg)"
              strokeWidth="0.1"
              paintOrder="stroke"
            >
              {runner.slot + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
