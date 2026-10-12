// Compact personal feedback leaves the shared stage room for its chart or explanation.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { LightningControllerView } from '../server/views';
import { SHAPES, Shape, choiceClass } from './ClassicParts';
import { STRINGS } from './strings';
import styles from './GroupRevealStage.module.css';

export function GroupStageVerdict({ view }: { view: LightningControllerView }): JSX.Element | null {
  const L = useT(STRINGS);
  if (view.phaseId !== 'reveal' || !view.participating || !view.group || !view.outcome) return null;
  const group = view.group;
  const outcome = view.outcome;
  const final = view.round?.last === true;
  const vote = group.mode === 'tv-vote';
  // Do not consult the hidden final team envelope, even if a malformed caller includes rows.
  const team = final ? undefined : group.teams.find((candidate) => candidate.id === group.myTeamId);
  const verdict = vote
    ? outcome.correct
      ? 'The room got it right!'
      : group.decision === undefined
        ? 'No room answer'
        : 'The room got it wrong'
    : outcome.correct
      ? 'Correct!'
      : outcome.answered
        ? 'Wrong'
        : 'Too slow';
  return (
    <div
      className={styles.receipt}
      data-group-stage-verdict="true"
      data-final-hidden={final || undefined}
      role="status"
    >
      <p className={styles.primaryRow}>
        <b>{L(verdict)}</b>
        {vote ? (
          view.myPickIndex === null ? (
            <span>{L('You did not vote')}</span>
          ) : (
            <span className={styles.myVote}>
              <span>{L('Your vote:')}</span>
              <span
                className={[styles.voteMark, choiceClass(view.myPickIndex)].join(' ')}
                role="img"
                aria-label={L(SHAPES[view.myPickIndex] ?? '')}
              >
                <Shape index={view.myPickIndex} className={styles.shape} />
              </span>
            </span>
          )
        ) : (
          <span>{L('+{n} personal points', { n: outcome.delta })}</span>
        )}
      </p>
      {team ? (
        <p className={styles.teamRow}>
          <b>{team.name}</b>
          {!vote && team.correctPercent !== undefined ? (
            <span>{L('{n}% correct', { n: team.correctPercent })}</span>
          ) : null}
          <span>{L('+{n} points', { n: team.gained })}</span>
        </p>
      ) : null}
      {final ? <p className={styles.cue}>{L('The podium is next')}</p> : null}
    </div>
  );
}
