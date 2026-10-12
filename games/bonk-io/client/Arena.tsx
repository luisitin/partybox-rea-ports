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
  /** Tween between received snapshots only while the round is playing and unpaused. */
  animate?: boolean;
}

const pose = (ball: Pick<Ball, 'x' | 'y'>): CSSProperties => ({
  transform: `translate(${ball.x}px, ${ball.y}px)`,
});

/** Edge labels indicate off-screen balls; they are never physical ball positions. */
function aboveMarkers(balls: readonly Ball[], width: number): { ball: Ball; x: number }[] {
  const margin = BALL_RADIUS + 12;
  const markers = balls
    .filter((ball) => ball.alive && ball.y < BALL_RADIUS)
    .sort((a, b) => a.x - b.x || a.slot - b.slot)
    .map((ball) => ({ ball, x: Math.max(margin, Math.min(width - margin, ball.x)) }));
  const gap = Math.min(
    BALL_RADIUS * 2 + 16,
    (width - margin * 2) / Math.max(1, markers.length - 1),
  );
  for (let index = 1; index < markers.length; index++)
    markers[index]!.x = Math.max(markers[index]!.x, markers[index - 1]!.x + gap);
  if (markers.length > 0)
    markers[markers.length - 1]!.x = Math.min(markers[markers.length - 1]!.x, width - margin);
  for (let index = markers.length - 2; index >= 0; index--)
    markers[index]!.x = Math.min(markers[index]!.x, markers[index + 1]!.x - gap);
  return markers;
}

/** Snapshot art only: the server supplies every position and every platform edge. */
export function Arena({
  balls,
  platforms,
  width,
  height,
  hazard,
  me,
  animate = false,
}: ArenaProps): JSX.Element {
  const L = useT(STRINGS);
  const stripeId = useId().replaceAll(':', '');
  const above = aboveMarkers(balls, width);
  const indicated = new Set(above.map(({ ball }) => ball.id));
  const aboveLabel = (ball: Ball): string =>
    [
      L('Ball {n}: above the arena', { n: ball.slot + 1 }),
      ball.heavy ? L('Heavy') : '',
      ball.id === me ? L('Your ball') : '',
    ]
      .filter(Boolean)
      .join(' · ');
  const visible = balls.filter(
    (ball) =>
      !indicated.has(ball.id) &&
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
      aria-label={
        L('Arena: {n} balls still in. Falling off means out.', {
          n: balls.filter((ball) => ball.alive).length,
        }) +
        (above.length > 0
          ? ` ${L('Above the arena: balls {numbers}', {
              numbers: above
                .map(({ ball }) => ball.slot + 1)
                .sort((a, b) => a - b)
                .join(', '),
            })}`
          : '')
      }
      data-hazard={hazard ? 'true' : undefined}
      data-animate={animate ? 'true' : undefined}
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
          style={{ ...playerStyle(ball.slot), ...pose(ball) } as CSSProperties}
          data-heavy={ball.heavy && ball.alive ? 'true' : undefined}
          data-out={!ball.alive ? 'true' : undefined}
          className={`${styles.ball} ${styles.position}`}
          data-pose-seat={ball.slot + 1}
          data-pose-layer="body"
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
            <circle cx={0} cy={0} r={BALL_RADIUS + 12} className={styles.myRing} />
          ) : null}
          <circle cx={0} cy={0} r={BALL_RADIUS} className={styles.body} />
          {ball.heavy && ball.alive ? (
            <>
              <circle cx={0} cy={0} r={BALL_RADIUS + 6} className={styles.heavyRing} />
              <path
                d={`M${-BALL_RADIUS - 9} -8 v16 M${BALL_RADIUS + 9} -8 v16`}
                className={styles.weight}
              />
            </>
          ) : null}
        </g>
      ))}
      {above.map(({ ball, x }) => (
        <g
          key={`above-${ball.id}`}
          className={styles.edge}
          style={playerStyle(ball.slot) as CSSProperties}
          data-above-seat={ball.slot + 1}
          data-heavy={ball.heavy ? 'true' : undefined}
          role="img"
          aria-label={aboveLabel(ball)}
        >
          <title>{aboveLabel(ball)}</title>
          {ball.id === me ? (
            <rect x={x - 34} y={13} width={68} height={68} rx={12} className={styles.myRing} />
          ) : null}
          <rect
            x={x - BALL_RADIUS}
            y={19}
            width={BALL_RADIUS * 2}
            height={56}
            rx={8}
            className={styles.edgeBox}
          />
          <path
            d={`M${x - 14} 15 L${x} 5 L${x + 14} 15 M${x} 6 v12`}
            className={styles.edgeArrow}
          />
          {ball.heavy ? (
            <path d={`M${x - 37} 29 v32 M${x + 37} 29 v32`} className={styles.weight} />
          ) : null}
        </g>
      ))}
      {/* Numbers are the final layer, so nearby heavy rings never cover another seat's identity. */}
      {visible.map((ball) => (
        <g
          key={`number-${ball.id}`}
          style={pose(ball)}
          className={styles.position}
          data-pose-seat={ball.slot + 1}
          data-pose-layer="number"
        >
          <text
            x={0}
            y={0}
            className={styles.number}
            textAnchor="middle"
            dominantBaseline="central"
            data-seat-number={ball.slot + 1}
            data-marker="ball"
          >
            {ball.slot + 1}
          </text>
        </g>
      ))}
      {above.map(({ ball, x }) => (
        <text
          key={`above-number-${ball.id}`}
          x={x}
          y={47}
          className={styles.number}
          textAnchor="middle"
          dominantBaseline="central"
          data-seat-number={ball.slot + 1}
          data-marker="ball"
          data-offscreen="above"
        >
          {ball.slot + 1}
        </text>
      ))}
    </svg>
  );
}
