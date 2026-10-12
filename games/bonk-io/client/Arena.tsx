import { useId } from 'react';
import type { CSSProperties, JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import { BALL_RADIUS } from '../server/types';
import type { Ball } from '../server/types';
import { playerStyle } from './standings';
import { STRINGS } from './strings';
import styles from './Arena.module.css';

export interface ArenaProps {
  balls: readonly Ball[];
  platforms: readonly { id: string; x: number; y: number; width: number; height: number }[];
  width: number;
  height: number;
  hazard: boolean;
  me?: string;
}

/** Snapshot art only: the server supplies every position and every platform edge. */
export function Arena({ balls, platforms, width, height, hazard, me }: ArenaProps): JSX.Element {
  const L = useT(STRINGS);
  const stripeId = useId().replaceAll(':', '');
  const visible = balls.filter(
    (ball) =>
      ball.x >= -BALL_RADIUS &&
      ball.x <= width + BALL_RADIUS &&
      ball.y >= -BALL_RADIUS &&
      ball.y <= height + BALL_RADIUS,
  );
  return (
    <svg
      className={styles.arena}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={L('Arena: {n} balls still in. Falling off means out.', {
        n: balls.filter((ball) => ball.alive).length,
      })}
      data-hazard={hazard ? 'true' : undefined}
    >
      <defs>
        <pattern
          id={stripeId}
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="32" height="32" className={styles.lava} />
          <rect width="12" height="32" className={styles.lavaStripe} />
        </pattern>
      </defs>
      <rect width={width} height={height} className={styles.sky} />
      <path d={`M0 ${height - 18} H${width}`} className={styles.fallLine} />
      <rect y={height - 18} width={width} height="18" fill={`url(#${stripeId})`} />
      {platforms.map((platform) => (
        <g key={platform.id}>
          <rect
            x={platform.x}
            y={platform.y}
            width={platform.width}
            height={platform.height}
            rx="4"
            className={styles.platform}
          />
          <path
            d={`M${platform.x} ${platform.y} h${platform.width}`}
            className={styles.platformTop}
          />
          {hazard && platform.width > 24 ? (
            <path
              d={`M${platform.x + 4} ${platform.y + 3} l9 5 -9 5 M${platform.x + platform.width - 4} ${platform.y + 3} l-9 5 9 5`}
              className={styles.shrinkMarks}
            />
          ) : null}
        </g>
      ))}
      {visible.map((ball) => (
        <g
          key={ball.id}
          style={playerStyle(ball.slot) as CSSProperties}
          data-heavy={ball.heavy && ball.alive ? 'true' : undefined}
          data-out={!ball.alive ? 'true' : undefined}
          className={styles.ball}
        >
          <title>
            {L('Ball {n}: {status}', {
              n: ball.slot + 1,
              status:
                ball.cause === 'left'
                  ? L('Left')
                  : !ball.alive
                    ? L('Out')
                    : ball.heavy
                      ? L('Heavy')
                      : L('Rolling'),
            })}
          </title>
          {ball.id === me && ball.alive ? (
            <circle cx={ball.x} cy={ball.y} r={BALL_RADIUS + 12} className={styles.myRing} />
          ) : null}
          <circle cx={ball.x} cy={ball.y} r={BALL_RADIUS} className={styles.body} />
          {ball.heavy && ball.alive ? (
            <>
              <circle cx={ball.x} cy={ball.y} r={BALL_RADIUS + 6} className={styles.heavyRing} />
              <path
                d={`M${ball.x - BALL_RADIUS - 9} ${ball.y - 8} v16 M${ball.x + BALL_RADIUS + 9} ${ball.y - 8} v16`}
                className={styles.weight}
              />
            </>
          ) : null}
        </g>
      ))}
      {/* Numbers are the final layer, so nearby heavy rings never cover another seat's identity. */}
      {visible.map((ball) => (
        <text
          key={`number-${ball.id}`}
          x={ball.x}
          y={ball.y}
          className={styles.number}
          textAnchor="middle"
          dominantBaseline="central"
          data-seat-number={ball.slot + 1}
          data-marker="ball"
        >
          {ball.slot + 1}
        </text>
      ))}
    </svg>
  );
}
