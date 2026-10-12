// Discussion has no answer controls; staged phones can discover only their own fixed teammates.
import type { JSX } from 'react';
import { Screen, useT } from '@partybox/game-sdk/ui';
import type { LightningControllerView } from '../server/views';
import { QuestionOptions } from './ClassicParts';
import { GroupIdentity, GroupRoster } from './GroupParts';
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
  const ownTeam =
    view.participating && group?.mode === 'teams'
      ? group.teams.find((team) => team.id === group.myTeamId && team.members.includes(view.me.id))
      : undefined;
  const question = showStage ? (view.stage?.question ?? view.question) : null;
  return (
    <Screen className={[classic.phoneScreen, styles.phone].join(' ')} ghost={false}>
      <div className={styles.talk} data-stage={showStage || undefined}>
        <header className={classic.phoneHeader}>
          <h2>
            {L(
              view.participating
                ? group?.mode === 'teams'
                  ? 'Talk with your team'
                  : 'Discuss the room answer'
                : group?.mode === 'teams'
                  ? 'Watching team discussion'
                  : 'Watching room discussion',
            )}
          </h2>
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
        {group && ownTeam ? (
          showStage ? (
            <details className={styles.teamDisclosure} data-team-discovery="true">
              <summary>
                <span className={styles.disclosureClosed}>
                  {L('{team} · Teammates', { team: ownTeam.name })}
                </span>
                <span className={styles.disclosureOpen}>{L('Back to question')}</span>
              </summary>
              <GroupRoster group={group} players={view.players} mine presence />
            </details>
          ) : (
            <GroupRoster group={group} players={view.players} mine presence />
          )
        ) : group ? (
          <GroupIdentity group={group} />
        ) : null}
        {question ? (
          <div className={styles.talkQuestion} data-talk-question="true">
            <h3 className={[classic.phonePrompt, styles.talkPrompt].join(' ')}>{question.text}</h3>
            <div className={styles.talkChoices}>
              <QuestionOptions question={question} />
            </div>
          </div>
        ) : null}
        <p className={styles.rule}>
          {L(
            !view.participating
              ? 'Players discuss now. Answers open when the clock ends.'
              : group?.mode === 'teams'
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
      </div>
    </Screen>
  );
}
