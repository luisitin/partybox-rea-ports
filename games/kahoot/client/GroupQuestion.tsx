// Group play follows the source quiz geometry with our shared shape art and token styling.
import { useCallback } from 'react';
import type { JSX } from 'react';
import { Timer, useSound, useT } from '@partybox/game-sdk/ui';
import type { LightningTvView } from '../server/views';
import { QuestionOptions } from './ClassicParts';
import { groupTitle } from './GroupParts';
import { STRINGS } from './strings';
import styles from './Group.module.css';

export function GroupQuestion({
  view,
  now,
}: {
  view: LightningTvView;
  now: number;
}): JSX.Element | null {
  if (!view.question || !view.group) return null;
  return <QuestionStage view={view} now={now} />;
}

function QuestionStage({ view, now }: { view: LightningTvView; now: number }): JSX.Element {
  const L = useT(STRINGS);
  const play = useSound();
  const onTick = useCallback(() => play('countdown', { quiet: true }), [play]);
  const group = view.group!;
  const talk = view.phaseId === 'talk';
  const vote = group.mode === 'tv-vote';
  const seconds =
    view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const instruction = talk
    ? vote
      ? 'Discuss the room answer · then everyone votes'
      : 'Talk with your team · then everyone answers'
    : vote
      ? 'Your votes choose one answer for the room'
      : 'Tap the matching shape on your phone';
  return (
    <div className={styles.questionStage} data-group-question={view.phaseId}>
      {/* The circular clock replaces shell digits, while the SDK retains its cue rules. */}
      <div hidden aria-hidden="true" data-group-countdown-cue="true">
        <Timer
          key={`${view.phaseId}:${view.question!.id}`}
          deadline={view.deadline}
          phaseKey={view.phaseId}
          phaseAt={view.phaseAt}
          paused={view.paused}
          clockHeldAt={view.clockHeldAt}
          onTick={onTick}
        />
      </div>
      <h2 className={styles.questionPrompt}>{view.question!.text}</h2>
      <div className={styles.questionMiddle}>
        <div className={styles.countdown} data-position="left">
          <span
            className={styles.countdownCircle}
            data-paused={view.paused || undefined}
            data-long={(seconds !== null && seconds >= 100) || undefined}
            role="timer"
            aria-label={view.paused ? L('Paused') : L('{n} seconds left', { n: seconds ?? 0 })}
          >
            {seconds ?? '—'}
          </span>
          {view.paused ? <b>{L('Paused')}</b> : null}
        </div>
        <p className={styles.questionInstruction}>{L(instruction)}</p>
        <div
          className={styles.answerCount}
          data-position="right"
          role="status"
          aria-label={L(vote ? '{n} of {m} voted' : '{n} of {m} answered', {
            n: view.answeredCount,
            m: view.totalCount,
          })}
        >
          <b>{view.answeredCount}</b>
          <span>{L(vote ? 'of {n} votes' : 'of {n} answers', { n: view.totalCount })}</span>
        </div>
      </div>
      <div className={styles.questionAnswers} data-position="bottom">
        <QuestionOptions question={view.question!} />
      </div>
      <footer className={styles.questionFooter}>
        <span>
          {L('Question {n} of {m}', { n: view.round?.number ?? 0, m: view.round?.total ?? 0 })}
        </span>
        <span>{L(groupTitle(group))}</span>
      </footer>
    </div>
  );
}
