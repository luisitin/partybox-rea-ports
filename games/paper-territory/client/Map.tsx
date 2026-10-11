// Territory is solid, vulnerable trails are dashed and every runner carries their seat number.
import { useId } from 'react';
import type { JSX } from 'react';
import { cellCenter, playerInk, territoryPaths, trailPath } from './mapMath';
import styles from './Map.module.css';

interface MapRunner {
  id: string;
  slot: number;
  home: number;
  cell: number;
  trail: number[];
  alive: boolean;
}

export interface MapProps {
  width: number;
  height: number;
  owners: number[];
  runners: MapRunner[];
  label: string;
  meId?: string;
}

export function Map({ width, height, owners, runners, label, meId }: MapProps): JSX.Element {
  const gridId = useId();
  const paths = territoryPaths(owners, width, height);
  return (
    <svg
      className={styles.map}
      viewBox={`-1 -1 ${width + 2} ${height + 2}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <pattern id={gridId} width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0H0V1" className={styles.grid} />
        </pattern>
      </defs>
      <rect width={width} height={height} className={styles.ground} />
      {[...paths].map(([slot, path]) => (
        <path key={slot} d={path} fill={playerInk(slot)} className={styles.territory} />
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
        .map((runner) => {
          const [x, y] = cellCenter(runner.cell, width);
          return (
            <g key={runner.id} transform={`translate(${x} ${y})`}>
              {runner.id === meId ? <circle r="1.02" className={styles.mine} /> : null}
              <circle
                r="0.7"
                fill="var(--pb-bg)"
                stroke={playerInk(runner.slot)}
                strokeWidth="0.18"
              />
              <text className={styles.number} textAnchor="middle" dominantBaseline="central">
                {runner.slot + 1}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
