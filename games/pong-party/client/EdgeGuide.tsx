// A small map of the player's real edge: the arrow follows the same clockwise tangent as an increasing slider input.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import { EDGES, PADDLE_HALF, VERTICES, paddleCenter } from '../server/world';
import { STRINGS } from './strings';
import styles from './EdgeGuide.module.css';

export function EdgeGuide({ slot, position }: { slot: number; position: number }): JSX.Element {
  const L = useT(STRINGS);
  const edge = EDGES[slot] ?? EDGES[0]!;
  const center = paddleCenter({
    id: '',
    slot: edge.slot,
    position,
    lives: 5,
    saves: 0,
    eliminatedAt: null,
  });
  const arrowX = edge.mx - edge.nx * 9;
  const arrowY = edge.my - edge.ny * 9;
  const tipX = arrowX + edge.tx * 5;
  const tipY = arrowY + edge.ty * 5;
  return (
    <svg
      className={styles.guide}
      viewBox="0 0 100 100"
      role="img"
      aria-label={L('Paddle {n}; sliding right moves clockwise around the arena', { n: slot + 1 })}
    >
      <polygon className={styles.court} points={VERTICES.map((p) => `${p.x},${p.y}`).join(' ')} />
      <line className={styles.edge} x1={edge.a.x} y1={edge.a.y} x2={edge.b.x} y2={edge.b.y} />
      <line
        className={styles.paddle}
        x1={center.x - edge.tx * PADDLE_HALF}
        y1={center.y - edge.ty * PADDLE_HALF}
        x2={center.x + edge.tx * PADDLE_HALF}
        y2={center.y + edge.ty * PADDLE_HALF}
      />
      <path
        className={styles.arrow}
        d={`M${arrowX - edge.tx * 5} ${arrowY - edge.ty * 5} L${tipX} ${tipY} M${tipX - edge.tx * 3 + edge.nx * 3} ${tipY - edge.ty * 3 + edge.ny * 3} L${tipX} ${tipY} L${tipX - edge.tx * 3 - edge.nx * 3} ${tipY - edge.ty * 3 - edge.ny * 3}`}
      />
      <text className={styles.number} x="50" y="50">
        {slot + 1}
      </text>
    </svg>
  );
}
