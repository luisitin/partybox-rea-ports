// The team's bar (T-0646): the team's score as a fill along a bar cut at B, A and S, and the grade it stands at now. Shared by
// the TV (big) and the phone (small). Dumb component.
import type { JSX } from 'react';
import type { Cuts, Grade } from '../../kaboom/grade';
import { useT } from '../../ui/lang';
import { STRINGS } from './strings';
import styles from './TeamBar.module.css';

export interface TeamBarProps {
  team: number;
  max: number;
  cuts: Cuts;
  grade: Grade;
  /** The screen reader's name for the number ("boxes"). */
  unit: string;
  big?: boolean;
  /** Print "Team score" beside (TV) or over (phone) the bar. */
  caption?: boolean;
}

const pct = (v: number, max: number): number => (max <= 0 ? 0 : Math.min(100, (v / max) * 100));

export function TeamBar({ team, max, cuts, grade, unit, big, caption }: TeamBarProps): JSX.Element {
  const L = useT(STRINGS);
  const marks: [Grade, number][] = [
    ['B', cuts[2]],
    ['A', cuts[1]],
    ['S', cuts[0]],
  ];
  return (
    <div
      className={styles.bar}
      data-big={big === true}
      data-caption={caption === true}
      data-grade={grade}
      role="img"
      aria-label={`${L('Team score')}: ${L('{team} of {max}', { team, max })} ${unit}. ${L('Rating {grade}', { grade })}`}
    >
      {caption === true ? <span className={styles.caption}>{L('Team score')}</span> : null}
      <div className={styles.track}>
        <i className={styles.fill} style={{ width: `${pct(team, max)}%` }} />
        {marks.map(([g, at]) => (
          <b
            key={g}
            className={styles.cut}
            data-hit={team >= at}
            style={{ left: `${pct(at, max)}%` }}
          >
            {g}
          </b>
        ))}
      </div>
      <span className={styles.medal} data-grade={grade} aria-hidden="true">
        {grade}
      </span>
      <span className={styles.num} aria-hidden="true">
        <small>{L('Team:')}</small> {team}
        <small> {unit}</small>
      </span>
    </div>
  );
}
