// Original geometric crossing map; all positions come from the server's judged view.
import type { CSSProperties, JSX } from 'react';
import type { Lane, Runner } from '../server/types';
import styles from './Board.module.css';

export interface MapView {
  lanes: Lane[];
  width: number;
  startRow: number;
  endRow: number;
}

export function playerStyle(slot: number): CSSProperties {
  return { '--racer': `var(--pb-player-${(slot % 8) + 1})` } as CSSProperties;
}

export function Board({
  map,
  runners,
  focus,
}: {
  map: MapView;
  runners: Runner[];
  focus?: Runner | null;
}): JSX.Element {
  const left = focus ? Math.max(0, Math.min(map.width - 7, Math.floor(focus.x) - 3)) : 0;
  const width = focus ? 7 : map.width;
  const endRow = focus
    ? Math.min(map.endRow, Math.max(map.startRow + 6, focus.row + 4))
    : map.endRow;
  const startRow = focus ? Math.max(map.startRow, endRow - 6) : map.startRow;
  const rows = endRow - startRow + 1;
  const y = (row: number): number => (endRow - row) * 60;
  return (
    <svg
      className={styles.map}
      viewBox={`${left * 60} 0 ${width * 60} ${rows * 60}`}
      role="img"
      aria-label={`Crossing map, rows ${startRow} to ${endRow}${focus ? `. You are racer ${focus.slot + 1}, row ${focus.row}` : ''}`}
    >
      {map.lanes
        .filter((lane) => lane.row >= startRow && lane.row <= endRow)
        .map((lane) => (
          <g key={lane.row} transform={`translate(0 ${y(lane.row)})`}>
            <rect width={map.width * 60} height={60} className={styles[lane.kind]} />
            {lane.kind === 'road' ? (
              <path d={`M0 30 H${map.width * 60}`} className={styles.dash} />
            ) : null}
            {lane.kind === 'river' ? (
              <path
                d={`M0 18 H${map.width * 60} M0 46 H${map.width * 60}`}
                className={styles.wave}
              />
            ) : null}
            {lane.blocked.map((x) => (
              <g key={x} transform={`translate(${x * 60 + 30} 30)`}>
                <path d="M-19 16 L0 -24 L19 16 Z" className={styles.tree} />
                <path d="M0 4 V22" className={styles.trunk} />
              </g>
            ))}
            {lane.objects.map((object, index) => (
              <g key={index} transform={`translate(${object.x * 60 + 30} 0)`}>
                <rect
                  x={2}
                  y={lane.kind === 'river' ? 12 : 8}
                  width={object.length * 60 - 4}
                  height={lane.kind === 'river' ? 36 : 44}
                  rx={8}
                  className={lane.kind === 'river' ? styles.log : styles.car}
                />
                {lane.kind === 'river' ? (
                  <path
                    d={`M12 23 H${object.length * 60 - 12} M12 37 H${object.length * 60 - 12}`}
                    className={styles.grain}
                  />
                ) : (
                  <>
                    <rect
                      x={10}
                      y={15}
                      width={object.length * 60 - 20}
                      height={14}
                      rx={4}
                      className={styles.window}
                    />
                    <path
                      d={`M13 8 V3 M13 52 V57 M${object.length * 60 - 13} 8 V3 M${object.length * 60 - 13} 52 V57`}
                      className={styles.wheels}
                    />
                  </>
                )}
              </g>
            ))}
            {!focus ? (
              <text x={8} y={49} className={styles.row}>
                {lane.row}
              </text>
            ) : null}
          </g>
        ))}
      {runners
        .filter((r) => r.row >= startRow && r.row <= endRow)
        .sort((a, b) => Number(a.id === focus?.id) - Number(b.id === focus?.id))
        .map((runner) => (
          <g
            key={runner.id}
            transform={`translate(${runner.x * 60 + 30} ${y(runner.row) + 30})`}
            style={playerStyle(runner.slot)}
            className={styles.runner}
            data-out={!runner.alive || undefined}
          >
            <title>{`Racer ${runner.slot + 1}${runner.id === focus?.id ? ' · you' : ''}${!runner.alive ? ' · returning' : ''}`}</title>
            <path d="M0 -26 L24 -8 L18 24 L-18 24 L-24 -8 Z" className={styles.racer} />
            <path d="M-9 -14 L0 -22 L9 -14" className={styles.beak} />
            <text y={13} className={styles.number}>
              {runner.slot + 1}
            </text>
            {!runner.alive ? (
              <path d="M-20 -20 L20 20 M20 -20 L-20 20" className={styles.cross} />
            ) : null}
          </g>
        ))}
    </svg>
  );
}
