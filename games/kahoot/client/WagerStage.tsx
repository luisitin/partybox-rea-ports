// Public question/results screens for spectator and departed wager seats; no answer controls.
import type { JSX } from 'react';
import { ContentLang, Screen, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { LightningControllerView } from '../server/views';
import { PublicStandings, QuestionOptions } from './ClassicParts';
import { difficultyText, drawText } from './labels';
import { WagerRevealStage } from './WagerRevealStage';
import { STRINGS } from './strings';
import styles from './Classic.module.css';

export function WagerStage({ view }: { view: LightningControllerView }): JSX.Element {
  const L = useT(STRINGS);
  const stage = view.stage;
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const left = view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const round = view.round?.final
    ? L('Final question')
    : L('Question {n} of {m}', { n: view.round?.number ?? 0, m: view.round?.total ?? 0 });
  if (view.phaseId === 'reveal') return <WagerRevealStage view={view} />;
  return (
    <Screen
      key={`${view.phaseId}:${view.round?.number}`}
      className={styles.phoneScreen}
      title={
        view.phaseId === 'intro'
          ? 'Kahoot!'
          : view.phaseId === 'done'
            ? L('Final standings')
            : view.phaseId === 'wager'
              ? L('Place your wagers')
              : round
      }
    >
      <div className={styles.stageSummary}>
        {view.paused ? <p className={styles.status}>{L('Paused')}</p> : null}
        {view.phaseId === 'intro' ? (
          <>
            <p>{stage ? drawText(stage.categoryLabel, L) : ''}</p>
            <p>{L('First question coming up…')}</p>
          </>
        ) : null}
        {view.phaseId === 'done' && view.me.role === 'player' ? (
          <div className={styles.personal}>
            {view.myRank !== undefined ? <b>{L('Place {rank}', { rank: view.myRank })}</b> : null}
            <span>{L('{n} points', { n: view.myScore })}</span>
          </div>
        ) : null}
        {view.phaseId === 'question' && stage?.question ? (
          <>
            <h2 className={styles.phonePrompt}>{stage.question.text}</h2>
            <ContentLang content={view.questionLang} className={styles.language} />
            <QuestionOptions question={stage.question} letters />
            <p
              className={styles.status}
              role="timer"
              aria-label={view.paused ? L('Paused') : L('{n} seconds left', { n: left ?? 0 })}
            >
              {left}
            </p>
            <p className={styles.status}>{L('Watching the quiz')}</p>
          </>
        ) : null}
        {view.phaseId === 'wager' ? (
          <>
            <p>
              {stage?.finalTopic
                ? `${L('Final question')}: ${L.sent(stage.finalTopic.subcategoryLabel)} · ${difficultyText(stage.finalTopic.difficulty, L)}`
                : L('Final question next')}
            </p>
            <p>{L('Right answer wins the bet · wrong answer loses it')}</p>
            <p className={styles.status}>{L('Watching the quiz')}</p>
          </>
        ) : null}
        {view.phaseId === 'wager' || view.phaseId === 'done' ? (
          <PublicStandings rows={stage?.standings ?? []} />
        ) : null}
      </div>
    </Screen>
  );
}
