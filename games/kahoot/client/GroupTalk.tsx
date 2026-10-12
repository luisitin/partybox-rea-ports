// Discussion is a timed public beat with no input controls, including on spectator phones.
import type { JSX } from 'react';
import { Screen, useT } from '@partybox/game-sdk/ui';
import type { LightningControllerView } from '../server/views';
import { QuestionOptions } from './ClassicParts';
import { GroupIdentity, GroupRoster, groupTitle } from './GroupParts';
import { STRINGS } from './strings';
import classic from './Classic.module.css';
import styles from './Group.module.css';

export function GroupTalk({
  view,
  showStage,
  seconds,
}: {
  view: LightningControllerView;
  showStage: boolean;
  seconds: number | null;
}): JSX.Element {
  const L = useT(STRINGS);
  const group = view.group;
  const question = showStage ? (view.stage?.question ?? view.question) : null;
  return (
    <Screen className={`${classic.phoneScreen} ${styles.phone}`} ghost={false}>
      <div className={styles.talk} data-stage={showStage || undefined}>
        <header className={classic.phoneHeader}>
          <h2>{L(group?.mode === 'teams' ? 'Talk with your team' : 'Discuss the room answer')}</h2>
          {seconds !== null ? (
            <span
              className={classic.phoneClock}
              role="timer"
              aria-label={view.paused ? L('Paused') : L('{n} seconds left', { n: seconds })}
            >
              {view.paused ? L('Paused') : seconds}
            </span>
          ) : null}
        </header>
        {group && !showStage && group.mode === 'teams' ? (
          <GroupRoster group={group} players={view.players} mine={view.participating} />
        ) : group ? (
          <GroupIdentity group={group} />
        ) : null}
        {question ? (
          <>
            <h3 className={classic.phonePrompt}>{question.text}</h3>
            <QuestionOptions question={question} />
          </>
        ) : null}
        <p className={styles.rule}>
          {L(
            group?.mode === 'teams'
              ? 'Discuss now. Everyone answers when the clock ends.'
              : 'Discuss now. Each vote helps choose one room answer.',
          )}
        </p>
        <p className={classic.status} role="status">
          {view.paused
            ? L('Paused')
            : view.participating
              ? L('Answers open after discussion')
              : L('Watching the quiz')}
        </p>
        {group && !view.participating ? (
          <p className={classic.status}>{L(groupTitle(group))}</p>
        ) : null}
      </div>
    </Screen>
  );
}
