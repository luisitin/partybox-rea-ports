// Render only the public, server-judged world. Geometry is shared with the pure engine, so the visible paddles match collisions.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import { BALL_RADIUS, EDGES, PADDLE_HALF, VERTICES, paddleCenter } from '../server/world';
import type { PongPartyTvView } from '../server/index';
import { slotStyle } from './standings';
import { STRINGS } from './strings';
import styles from './Arena.module.css';

export interface ArenaProps {
  world: PongPartyTvView['world'];
  checked: number;
  ownId?: string;
  compact?: boolean;
}

export function Arena({ world, checked, ownId, compact = false }: ArenaProps): JSX.Element {
  const L = useT(STRINGS);
  const alive = world.paddles.filter((p) => p.eliminatedAt === null).length;
  return (
    <svg
      className={styles.arena}
      data-compact={compact ? 'true' : undefined}
      viewBox="-8 -8 116 116"
      role="img"
      aria-label={L('Octagonal arena, {n} paddles defending and {balls} balls', {
        n: alive,
        balls: world.balls.length,
      })}
    >
      <polygon className={styles.court} points={VERTICES.map((p) => `${p.x},${p.y}`).join(' ')} />
      <circle className={styles.centerRing} cx="50" cy="50" r="8" />
      <path className={styles.centerMark} d="M47 50h6M50 47v6" />
      {EDGES.map((edge) => {
        const paddle = world.paddles.find((p) => p.slot === edge.slot);
        const out = paddle?.eliminatedAt !== null && paddle !== undefined;
        const own = paddle?.id === ownId;
        const center = paddle ? paddleCenter(paddle) : null;
        // Labels sit just outside each edge, leaving the balls' entire court clear.
        const labelX = edge.mx + edge.nx * 7;
        const labelY = edge.my + edge.ny * 7;
        return (
          <g
            key={edge.slot}
            style={slotStyle(edge.slot)}
            data-out={out ? 'true' : undefined}
            data-own={own ? 'true' : undefined}
          >
            <line
              className={paddle && !out ? styles.goal : styles.wall}
              x1={edge.a.x}
              y1={edge.a.y}
              x2={edge.b.x}
              y2={edge.b.y}
            />
            {paddle ? (
              <>
                {own ? <circle className={styles.ownRing} cx={labelX} cy={labelY} r="4.2" /> : null}
                <text className={styles.number} x={labelX} y={labelY}>
                  {out ? '×' : edge.slot + 1}
                </text>
                {center && !out ? (
                  <>
                    <line
                      className={styles.paddleEdge}
                      x1={center.x - edge.tx * PADDLE_HALF}
                      y1={center.y - edge.ty * PADDLE_HALF}
                      x2={center.x + edge.tx * PADDLE_HALF}
                      y2={center.y + edge.ty * PADDLE_HALF}
                    />
                    <line
                      className={styles.paddle}
                      x1={center.x - edge.tx * PADDLE_HALF}
                      y1={center.y - edge.ty * PADDLE_HALF}
                      x2={center.x + edge.tx * PADDLE_HALF}
                      y2={center.y + edge.ty * PADDLE_HALF}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </g>
        );
      })}
      {world.balls.map((ball) => (
        <g key={ball.id} data-serving={checked < ball.readyAt ? 'true' : undefined}>
          {checked < ball.readyAt ? (
            <circle className={styles.serveRing} cx={ball.x} cy={ball.y} r={BALL_RADIUS * 3.5} />
          ) : null}
          <circle className={styles.ballEdge} cx={ball.x} cy={ball.y} r={BALL_RADIUS * 1.9} />
          <circle className={styles.ball} cx={ball.x} cy={ball.y} r={BALL_RADIUS * 1.4} />
        </g>
      ))}
    </svg>
  );
}
