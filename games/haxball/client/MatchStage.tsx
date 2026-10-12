import type { JSX } from 'react';
import { Pitch } from './Pitch';
import {
  attackRight,
  clockText,
  goalCredit,
  jersey,
  matchHeadline,
  shortName,
  teamName,
} from './match';
import type { MatchView, Team } from './match';
import styles from './MatchStage.module.css';

export function TeamRoster({
  view,
  team,
  compact = false,
}: {
  view: MatchView;
  team: Team;
  compact?: boolean;
}): JSX.Element {
  return (
    <section className={styles.teamRoster} data-team={team} aria-label={`${teamName(team)} team`}>
      {!compact ? <h3>{teamName(team)} team</h3> : null}
      <ul className={compact ? styles.compactRoster : styles.roster}>
        {view.discs
          .filter((d) => d.team === team)
          .map((disc) => (
            <li
              key={disc.id}
              data-jersey={jersey(team, disc.number)}
              aria-label={`${jersey(team, disc.number)} · ${disc.name}${disc.helper ? ' · helper' : ''}${disc.departed ? ' · left' : !disc.connected ? ' · offline' : ''}`}
            >
              <b className={styles.jersey}>{jersey(team, disc.number)}</b>
              {!compact ? (
                <span className={styles.playerName} title={disc.name}>
                  {shortName(disc.name)}
                  {disc.helper || disc.departed || !disc.connected ? (
                    <small>{disc.helper ? 'Helper' : disc.departed ? 'Left' : 'Offline'}</small>
                  ) : null}
                </span>
              ) : disc.helper ? (
                <span className={styles.helperMark}>Helper</span>
              ) : null}
            </li>
          ))}
      </ul>
    </section>
  );
}

export function ScoreLine({ view, now }: { view: MatchView; now: number }): JSX.Element {
  return (
    <div className={styles.scoreLine} aria-label={`Red ${view.goals.red}, Blue ${view.goals.blue}`}>
      <div className={styles.teamScore} data-team="red">
        <span>Red {attackRight(view, 'red') ? '→' : '←'}</span>
        <b>{view.goals.red}</b>
      </div>
      <div
        className={styles.clock}
        role="timer"
        aria-label={
          view.paused
            ? 'Match paused'
            : view.phaseId === 'done'
              ? 'Match finished'
              : view.phaseId === 'halftime'
                ? 'Next half starts in'
                : `${view.half === 1 ? 'First' : 'Second'} half time left`
        }
      >
        <span>
          {view.phaseId === 'done'
            ? 'Final'
            : view.phaseId === 'halftime'
              ? 'Next half'
              : `Half ${view.half} / 2`}
        </span>
        <b>{view.phaseId === 'done' ? 'FT' : view.paused ? 'Ⅱ' : clockText(view.deadline, now)}</b>
      </div>
      <div className={styles.teamScore} data-team="blue">
        <span>{attackRight(view, 'blue') ? '→' : '←'} Blue</span>
        <b>{view.goals.blue}</b>
      </div>
    </div>
  );
}

export function MatchStage({
  view,
  now,
  mine,
  compact = false,
}: {
  view: MatchView;
  now: number;
  mine?: string;
  compact?: boolean;
}): JSX.Element {
  const credit = goalCredit(view);
  const accessibleCredit = goalCredit(view, 'accessible');
  const compactCredit =
    compact && view.phaseId === 'play' && credit ? goalCredit(view, 'jersey') : '';
  return (
    <div
      className={styles.match}
      data-haxball-stage="true"
      data-phase={view.phaseId}
      data-compact={compact || undefined}
    >
      <ScoreLine view={view} now={now} />
      <div
        className={styles.headline}
        role={view.phaseId === 'play' && !credit ? undefined : 'status'}
      >
        <h2
          data-hax-goal-credit={compactCredit ? 'true' : undefined}
          aria-label={compactCredit ? accessibleCredit : undefined}
          title={compactCredit ? accessibleCredit : undefined}
        >
          {compactCredit || matchHeadline(view)}
        </h2>
        {view.phaseId === 'halftime' ? (
          <p>Teams keep their jerseys. Goals switch when play restarts.</p>
        ) : null}
        {credit && !compactCredit ? (
          <p data-hax-goal-credit="true" aria-label={accessibleCredit} title={accessibleCredit}>
            {credit}
          </p>
        ) : null}
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.redRoster}>
          <TeamRoster view={view} team="red" compact={compact} />
        </div>
        <div className={styles.pitchBox}>
          <Pitch view={view} mine={mine} />
        </div>
        <div className={styles.blueRoster}>
          <TeamRoster view={view} team="blue" compact={compact} />
        </div>
      </div>
    </div>
  );
}
