import type { JSX } from 'react';
import { birdPosition, GAP, GATE_WIDTH, H, R, SPEED, W, X } from '../server/world';
import type { Bird, Gate } from '../server/world';
import styles from './Arena.module.css';

interface ArenaProps {
  bird: Bird;
  gates: Gate[];
  time: number;
  label: string;
  reduced: boolean;
}

/** SVG stays visible in server-rendered previews; collision decisions stay on the server. */
export function Arena({ bird, gates, time, label, reduced }: ArenaProps): JSX.Element {
  const t = bird.died === null ? time : Math.min(time, bird.died);
  const position = birdPosition(bird, t);
  const angle = reduced ? 0 : Math.max(-25, Math.min(35, position.v * 0.5));
  const y = Math.max(R, Math.min(H - R, position.y));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.arena} role="img" aria-label={label}>
      <rect width={W} height={H} className={styles.sky} />
      <path d={`M0 12 H${W} M0 88 H${W}`} className={styles.horizon} />
      <path d={`M0 0 H${W} M0 ${H} H${W}`} className={styles.boundary} />
      {gates.map((gate) => {
        const x = gate.x - (SPEED * t) / 1000;
        const top = gate.center - GAP / 2;
        const bottom = gate.center + GAP / 2;
        if (x + GATE_WIDTH < 0 || x > W) return null;
        return (
          <g key={gate.x}>
            <rect x={x} width={GATE_WIDTH} height={top} className={styles.tower} />
            <rect
              x={x}
              y={bottom}
              width={GATE_WIDTH}
              height={H - bottom}
              className={styles.tower}
            />
            <path
              d={`M${x + 2} ${top - 3} V5 Q${x + GATE_WIDTH / 2} 0 ${x + GATE_WIDTH - 2} 5 V${top - 3} M${x + 2} ${bottom + 3} V95 Q${x + GATE_WIDTH / 2} 100 ${x + GATE_WIDTH - 2} 95 V${bottom + 3}`}
              className={styles.arch}
            />
            <path
              d={`M${x} ${top} H${x + GATE_WIDTH} M${x} ${bottom} H${x + GATE_WIDTH}`}
              className={styles.ledge}
            />
          </g>
        );
      })}
      <g
        transform={`translate(${X} ${y}) rotate(${angle})`}
        data-out={bird.died !== null ? 'true' : undefined}
      >
        <path d="M-4 -3 L5 0 L-4 3 L-1 0 Z" className={styles.glider} />
        <path d="M-4 -3 L-1 0 L5 0 M-1 0 L-4 3" className={styles.fold} />
        {bird.died !== null ? <path d="M-4 -4 L4 4 M4 -4 L-4 4" className={styles.crash} /> : null}
      </g>
    </svg>
  );
}
