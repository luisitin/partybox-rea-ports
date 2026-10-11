// Original three-face SVG art. The mover uses the exact analytic path that the server judges.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { Block, Tower as TowerState } from '../server/types';
import { movingBlock, WIDTH } from '../server/world';
import { STRINGS } from './strings';
import styles from './Tower.module.css';

interface TowerProps {
  tower: TowerState;
  now: number;
  course: number;
  active: boolean;
  name: string;
  best?: boolean;
}

const FLOOR = 16;
const BASE_Y = 282;
const project = (x: number, z: number, floor: number): [number, number] => [
  150 + (x - z) * 0.72,
  BASE_Y + (x + z) * 0.36 - floor * FLOOR,
];
const points = (vertices: [number, number][]): string => vertices.map((p) => p.join(',')).join(' ');

function face(block: Block, floor: number): [number, number][] {
  const left = block.x - block.w / 2;
  const right = block.x + block.w / 2;
  const back = block.z - block.d / 2;
  const front = block.z + block.d / 2;
  return [
    project(left, back, floor),
    project(right, back, floor),
    project(right, front, floor),
    project(left, front, floor),
  ];
}

function BlockArt({
  block,
  floor,
  moving = false,
}: {
  block: Block;
  floor: number;
  moving?: boolean;
}): JSX.Element {
  const corners = face(block, floor);
  const a = corners[0] ?? [0, 0];
  const b = corners[1] ?? [0, 0];
  const c = corners[2] ?? [0, 0];
  const d = corners[3] ?? [0, 0];
  const down = (p: [number, number]): [number, number] => [p[0], p[1] + FLOOR - 1];
  return (
    <g className={styles.block} data-moving={moving || undefined}>
      <polygon className={styles.left} points={points([d, c, down(c), down(d)])} />
      <polygon className={styles.right} points={points([b, c, down(c), down(b)])} />
      <polygon className={styles.top} points={points([a, b, c, d])} />
    </g>
  );
}

export function Tower({ tower, now, course, active, name, best = false }: TowerProps): JSX.Element {
  const L = useT(STRINGS);
  const blocks = best ? tower.bestBlocks : tower.blocks;
  const top = Math.max(0, blocks.length - 1);
  const height = best ? tower.best : tower.height;
  const cropped = height >= blocks.length;
  // A retained top segment is centred in the same camera after every trim, even if its footprint drifts.
  const anchor = blocks.at(-1) ?? tower.footprint;
  const centre = project(anchor.x, anchor.z, 0);
  const shift = `translate(${150 - centre[0]} ${BASE_Y - centre[1]})`;
  const moving = active && tower.crashedAt === null && !best;
  const cameraHeight = Math.max(180, (top + 1) * FLOOR + 128);
  return (
    <svg
      className={styles.tower}
      viewBox={`0 ${340 - cameraHeight} 300 ${cameraHeight}`}
      role="img"
      aria-label={L('{name}: {height} floors', { name, height })}
    >
      <g aria-hidden="true" transform={shift}>
        <polygon
          className={styles.ground}
          points={points(face({ x: anchor.x, z: anchor.z, w: WIDTH + 24, d: WIDTH + 24 }, -0.4))}
        />
        {cropped ? (
          <path className={styles.continuation} d="M128 308 l8 8 8-8 8 8 8-8 8 8" />
        ) : null}
        {blocks.map((block, index) => (
          <BlockArt key={index} block={block} floor={index} />
        ))}
        {moving ? (
          <>
            <polygon className={styles.target} points={points(face(tower.footprint, top + 1))} />
            <BlockArt block={movingBlock(tower, now, course)} floor={top + 1} moving />
            <path
              className={styles.guide}
              d={`M${project(tower.footprint.x, tower.footprint.z, top + 1)[0]} ${project(tower.footprint.x, tower.footprint.z, top + 1)[1] - 12} v-12`}
            />
          </>
        ) : null}
      </g>
    </svg>
  );
}
