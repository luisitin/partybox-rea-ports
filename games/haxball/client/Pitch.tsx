import { useId } from 'react';
import type { JSX } from 'react';
import { BALL_R, GOAL_DEPTH, GOAL_HALF, H, PLAYER_R, POST_R, W } from '../server/types';
import type { MatchView } from './match';
import { jersey } from './match';
import styles from './Pitch.module.css';

export function Pitch({ view, mine }: { view: MatchView; mine?: string }): JSX.Element {
  const id = useId();
  const description = view.discs
    .map(
      (d) =>
        `${jersey(d.team, d.number)} ${d.name}${d.helper ? ' (helper)' : d.departed ? ' (left)' : !d.connected ? ' (offline)' : ''}`,
    )
    .join('; ');
  return (
    <svg
      className={styles.pitch}
      viewBox={`${-GOAL_DEPTH - 4} -6 ${W + GOAL_DEPTH * 2 + 8} ${H + 12}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-description`}
      data-haxball-pitch="true"
    >
      <title id={`${id}-title`}>
        Haxball pitch · Red {view.goals.red}, Blue {view.goals.blue}
      </title>
      <desc id={`${id}-description`}>Numbered team discs and the ball. {description}</desc>
      <rect className={styles.field} x={0} y={0} width={W} height={H} rx={2} />
      <path className={styles.marking} d={`M${W / 2} 0V${H}`} />
      <circle className={styles.marking} cx={W / 2} cy={H / 2} r={14} />
      <circle className={styles.centre} cx={W / 2} cy={H / 2} r={1} />
      <g
        data-team={view.redAttacksRight ? 'blue' : 'red'}
        data-goal-for={view.redAttacksRight ? 'blue' : 'red'}
      >
        <title>
          {view.redAttacksRight ? 'Blue attacks the left goal' : 'Red attacks the left goal'}
        </title>
        <path className={styles.attackArrow} d="M17 10H5L9 6M5 10L9 14" />
        <text className={styles.attackLabel} x={20} y={10} dominantBaseline="central">
          {view.redAttacksRight ? 'B' : 'R'}
        </text>
      </g>
      <g
        data-team={view.redAttacksRight ? 'red' : 'blue'}
        data-goal-for={view.redAttacksRight ? 'red' : 'blue'}
      >
        <title>
          {view.redAttacksRight ? 'Red attacks the right goal' : 'Blue attacks the right goal'}
        </title>
        <path
          className={styles.attackArrow}
          d={`M${W - 17} 10H${W - 5}L${W - 9} 6M${W - 5} 10L${W - 9} 14`}
        />
        <text
          className={styles.attackLabel}
          x={W - 20}
          y={10}
          textAnchor="end"
          dominantBaseline="central"
        >
          {view.redAttacksRight ? 'R' : 'B'}
        </text>
      </g>
      <rect
        className={styles.goal}
        x={-GOAL_DEPTH}
        y={H / 2 - GOAL_HALF}
        width={GOAL_DEPTH}
        height={GOAL_HALF * 2}
      />
      <rect
        className={styles.goal}
        x={W}
        y={H / 2 - GOAL_HALF}
        width={GOAL_DEPTH}
        height={GOAL_HALF * 2}
      />
      <path
        className={styles.marking}
        d={`M0 ${H / 2 - GOAL_HALF - 7}H18V${H / 2 + GOAL_HALF + 7}H0 M${W} ${H / 2 - GOAL_HALF - 7}H${W - 18}V${H / 2 + GOAL_HALF + 7}H${W}`}
      />
      {[-1, 1].flatMap((side) =>
        [-1, 1].map((end) => (
          <circle
            key={`${side}:${end}`}
            className={styles.post}
            cx={side === -1 ? 0 : W}
            cy={H / 2 + end * GOAL_HALF}
            r={POST_R}
          />
        )),
      )}
      {view.discs.map((disc) => (
        <g
          key={disc.id}
          data-team={disc.team}
          data-jersey={jersey(disc.team, disc.number)}
          data-mine={disc.id === mine || undefined}
          data-offline={!disc.connected || disc.departed || undefined}
          transform={`translate(${disc.x} ${disc.y})`}
        >
          <title>
            {jersey(disc.team, disc.number)} · {disc.name}
          </title>
          {disc.id === mine ? <circle className={styles.mine} r={PLAYER_R + 2} /> : null}
          <circle className={styles.disc} r={PLAYER_R + 0.7} />
          <text className={styles.number} textAnchor="middle" dominantBaseline="central">
            {jersey(disc.team, disc.number)}
          </text>
          {disc.helper ? <path className={styles.helper} d="M-1.5 -7H1.5M0 -8.5V-5.5" /> : null}
          {disc.departed ? <path className={styles.left} d="M-4 -4L4 4M-4 4L4 -4" /> : null}
        </g>
      ))}
      <circle className={styles.ballHalo} cx={view.ball.x} cy={view.ball.y} r={BALL_R + 1} />
      <circle className={styles.ball} cx={view.ball.x} cy={view.ball.y} r={BALL_R} />
    </svg>
  );
}
