// Classic answers stay shape-only beside a visible TV; every other phone carries the public stage.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import {
  ContentLang,
  MOTION_SLOW,
  PrimaryButton,
  Screen,
  buzz,
  usePhoneOnly,
  useServerNow,
  useSound,
  useT,
} from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { LightningControllerView } from '../server/views';
import type { Input } from '../server/types';
import {
  ClassicChart,
  Podium,
  PublicStandings,
  QuestionOptions,
  SHAPES,
  Shape,
  choiceClass,
  podiumLabel,
} from './ClassicParts';
import { REVEAL_BEAT_MS } from './timing';
import { STRINGS } from './strings';
import styles from './Classic.module.css';
import { PhoneNext } from './NextStep';
import {
  GroupIdentity,
  GroupRoster,
  GroupVerdict,
  GroupDecision,
  GroupPlayerBar,
  groupTitle,
} from './GroupParts';
import { GroupTalk } from './GroupTalk';
import { GroupIntroRules } from './GroupIntroRules';
import { GroupAnswerChart } from './GroupAnswerChart';
import { GroupExplanation } from './GroupExplanation';
import { GroupStageVerdict } from './GroupStageVerdict';
import groups from './Group.module.css';

interface Pending {
  key: string;
  index: number;
  at: number;
}

export function ClassicController({
  view,
  send,
  skip,
}: GameControllerProps<LightningControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const play = useSound();
  const now = useServerNow(100, view.paused, view.clockHeldAt);
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const stage = view.stage;
  const group = view.group;
  const vote = group?.mode === 'tv-vote';
  const showStage = view.showStage || phoneOnly || !view.participating;
  const besideGroupReveal =
    group !== undefined && view.participating && !showStage && view.phaseId === 'reveal';
  const stamp = view.answerStamp;
  const key = stamp ? `${stamp.questionId}:${stamp.questionStartedAt}` : '';
  const mine = pending?.key === key ? pending : null;
  const connected = view.players.find((seat) => seat.id === view.me.id)?.connected !== false;
  const canAnswer =
    view.phaseId === 'question' &&
    view.participating &&
    connected &&
    !view.paused &&
    view.myPickIndex === null &&
    stamp !== undefined &&
    (view.deadline === null || now < view.deadline);
  const selected = view.myPickIndex ?? mine?.index ?? null;
  const retry = canAnswer && mine !== null && now - mine.at >= MOTION_SLOW * 2;
  const question = showStage ? (stage?.question ?? view.question) : null;
  const round = L('Question {n} of {m}', { n: view.round?.number ?? 0, m: view.round?.total ?? 0 });
  const seconds =
    view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const leaderboard =
    view.phaseId === 'reveal' && stage?.leaderboardAt !== undefined && now >= stage.leaderboardAt;
  const explanation =
    view.phaseId === 'reveal' && stage?.explanationAt !== undefined && now >= stage.explanationAt;
  const verdictAt = view.revealAt ?? view.phaseAt;
  const shown = view.phaseId === 'reveal' && now >= verdictAt + REVEAL_BEAT_MS;
  const cue = useRef({ key: '', done: false });
  useEffect(() => {
    const revealKey =
      view.phaseId === 'reveal' && view.participating && view.outcome
        ? `${view.round?.number}:${view.phaseAt}`
        : '';
    const elapsed = now - verdictAt;
    if (cue.current.key !== revealKey)
      cue.current = { key: revealKey, done: elapsed >= REVEAL_BEAT_MS };
    if (!revealKey || view.paused || !shown || cue.current.done) return;
    cue.current.done = true;
    play(view.outcome?.correct ? 'correct' : 'wrong');
    buzz(view.outcome?.correct ? [30, 40, 30] : 120);
  }, [
    view.phaseId,
    view.phaseAt,
    view.round?.number,
    view.outcome,
    view.participating,
    view.paused,
    verdictAt,
    shown,
    now,
    play,
  ]);

  const answer = (index: number): void => {
    if (!canAnswer || !stamp || pendingRef.current?.key === key) return;
    const next = { key, index, at: now };
    pendingRef.current = next;
    setPending(next);
    buzz(20);
    send({ type: 'answer', ...stamp, index });
  };
  const resend = (): void => {
    if (!retry || !mine || !stamp) return;
    const next = { ...mine, at: now };
    pendingRef.current = next;
    setPending(next);
    send({ type: 'answer', ...stamp, index: mine.index });
  };
  const personal = (
    <div className={styles.personal}>
      {view.myRank !== undefined ? <b>{L('Place {rank}', { rank: view.myRank })}</b> : null}
      <span>{L('{n} points', { n: view.myScore })}</span>
      {view.myStreak >= 2 ? <span>{L('{n} correct in a row', { n: view.myStreak })}</span> : null}
    </div>
  );

  if (view.phaseId === 'talk')
    return <GroupTalk view={view} showStage={showStage} seconds={seconds} />;

  if (view.phaseId === 'question') {
    const status = view.paused
      ? L('Paused')
      : !view.participating
        ? L('Watching the quiz')
        : !connected
          ? L('Disconnected. Waiting to reconnect.')
          : view.myPickIndex !== null
            ? L(vote ? '✓ Your vote is locked in' : '✓ Answer locked in')
            : seconds === 0
              ? L('Time is up')
              : mine
                ? retry
                  ? L(
                      vote
                        ? 'Not confirmed yet. Send your vote again.'
                        : 'Not confirmed yet. Send your answer again.',
                    )
                  : L(vote ? 'Sending your vote…' : 'Sending your answer…')
                : showStage
                  ? L(vote ? 'Tap your vote' : 'Tap your answer')
                  : L(vote ? 'Vote for the matching shape' : 'Tap the matching shape');
    return (
      <Screen
        key={key || `question:${view.round?.number}`}
        className={`${styles.phoneScreen} ${groups.phone}`}
        ghost={false}
      >
        <div
          className={styles.phoneQuestion}
          data-stage={showStage || undefined}
          data-group={group?.mode}
        >
          <header className={styles.phoneHeader}>
            <h2>{round}</h2>
            {showStage && seconds !== null ? (
              <span
                className={styles.phoneClock}
                role="timer"
                aria-label={view.paused ? L('Paused') : L('{n} seconds left', { n: seconds })}
              >
                {view.paused ? L('Paused') : seconds}
              </span>
            ) : null}
          </header>
          {group ? <GroupIdentity group={group} /> : null}
          {question ? (
            <>
              <h3 className={styles.phonePrompt}>{question.text}</h3>
              <ContentLang content={view.questionLang} className={styles.language} />
            </>
          ) : null}
          {view.participating ? (
            <div
              className={styles.pads}
              role="group"
              aria-label={L(vote ? 'Vote choices' : 'Answer choices')}
            >
              {SHAPES.map((shape, index) => (
                <button
                  key={shape}
                  type="button"
                  className={`${styles.pad} ${choiceClass(index)}`}
                  aria-label={
                    question
                      ? L('{shape}: {answer}', {
                          shape: L(shape),
                          answer: question.choices[index] ?? '',
                        })
                      : L(shape)
                  }
                  aria-pressed={selected === index}
                  data-selected={selected === index || undefined}
                  disabled={!canAnswer || selected !== null}
                  onClick={() => answer(index)}
                >
                  <Shape index={index} className={styles.shape} />
                  {question ? <span>{question.choices[index]}</span> : null}
                  {selected === index ? (
                    <span className={styles.check} aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : question ? (
            <QuestionOptions question={question} />
          ) : null}
          <div className={styles.answerStatus}>
            {group && showStage && stage?.phaseId === 'question' ? (
              <p className={styles.status} role="status" data-group-progress="true">
                {L(vote ? '{n} of {m} voted' : '{n} of {m} answered', {
                  n: stage.answeredCount,
                  m: stage.totalCount,
                })}
              </p>
            ) : null}
            <p className={styles.status} role="status">
              {status}
            </p>
            {retry ? <PrimaryButton onClick={resend}>{L('Send again')}</PrimaryButton> : null}
          </div>
        </div>
      </Screen>
    );
  }
  const revealNext =
    view.participating && view.next && skip ? (
      <PhoneNext
        next={view.next}
        skip={skip}
        phaseKey={view.deadline}
        revealAt={view.revealAt}
        paused={view.paused}
        clockHeldAt={view.clockHeldAt}
        leaderboardAt={view.leaderboardAt}
        nextAt={view.nextAt}
      />
    ) : undefined;
  if (view.phaseId === 'reveal' && group && showStage && stage)
    return (
      <Screen
        key={`reveal:${view.round?.number}`}
        className={`${styles.phoneScreen} ${groups.phone}`}
        title={round}
        footer={
          <div className={groups.revealFooter}>
            {view.participating ? (
              shown && view.outcome ? (
                <GroupStageVerdict view={view} />
              ) : (
                <p className={styles.status}>{L('Your result is coming…')}</p>
              )
            ) : null}
            {revealNext}
          </div>
        }
      >
        {view.paused ? <p className={styles.status}>{L('Paused')}</p> : null}
        {leaderboard ? (
          <>
            <h2 className={styles.headline}>{L(vote ? 'Room score' : 'Team scoreboard')}</h2>
            <PublicStandings rows={stage.standings ?? []} me={group.myTeamId} gains />
          </>
        ) : explanation ? (
          <GroupExplanation view={stage} />
        ) : (
          <GroupAnswerChart view={stage} />
        )}
      </Screen>
    );
  if (view.phaseId === 'reveal')
    return (
      <Screen
        key={`reveal:${view.round?.number}`}
        className={`${styles.phoneScreen} ${groups.phone}`}
        title={round}
        footer={
          besideGroupReveal ? (
            <div className={groups.revealFooter}>
              {revealNext}
              <GroupPlayerBar view={view} />
            </div>
          ) : (
            revealNext
          )
        }
      >
        {view.participating && shown && view.outcome ? (
          group ? (
            <GroupVerdict view={view} besideTv={besideGroupReveal} />
          ) : (
            <div className={styles.verdict} role="status">
              <h3>
                {view.outcome.correct
                  ? L('Correct!')
                  : view.outcome.answered
                    ? L('Wrong')
                    : L('Too slow')}
              </h3>
              <b>{L('+{n} points', { n: view.outcome.delta })}</b>
              <p>
                {L('{n} total', { n: view.myScore })}
                {view.myRank !== undefined ? ` · ${L('Place {rank}', { rank: view.myRank })}` : ''}
              </p>
              {view.outcome.correct && view.outcome.base !== undefined ? (
                <p>
                  {L('{n} speed points', { n: view.outcome.base })}
                  {view.outcome.bonus
                    ? ` · ${L('+{n} streak bonus', { n: view.outcome.bonus })}`
                    : ''}
                </p>
              ) : null}
              {view.myStreak >= 2 ? <p>{L('{n} correct in a row', { n: view.myStreak })}</p> : null}
              {view.round?.last ? <p>{L('The podium is next')}</p> : null}
            </div>
          )
        ) : view.participating ? (
          <p className={`${styles.status} ${besideGroupReveal ? groups.pendingResult : ''}`}>
            {L('Your result is coming…')}
          </p>
        ) : null}
        {view.paused ? <p className={styles.status}>{L('Paused')}</p> : null}
        {showStage && stage ? (
          leaderboard ? (
            <>
              <h2 className={styles.headline}>
                {L(group ? (vote ? 'Room score' : 'Team scoreboard') : 'Scoreboard')}
              </h2>
              <PublicStandings
                rows={stage.standings ?? []}
                me={group?.myTeamId ?? view.me.id}
                gains={group !== undefined}
              />
            </>
          ) : (
            <>
              <p className={styles.asked}>{stage.question?.text}</p>
              <GroupDecision view={stage} />
              <ClassicChart view={stage} />
            </>
          )
        ) : null}
      </Screen>
    );
  if (view.phaseId === 'podium')
    return (
      <Screen
        key={`podium:${view.podium?.rank}`}
        className={styles.phoneScreen}
        title={L('The podium')}
      >
        <h2 className={styles.headline}>{L(podiumLabel(view.podium?.rank ?? 1))}</h2>
        {view.paused ? <p className={styles.status}>{L('Paused')}</p> : null}
        {(showStage && stage) || group ? (
          <Podium view={stage ?? view} />
        ) : (
          <p className={styles.status}>{L('The final places are being revealed')}</p>
        )}
        {view.participating && view.myRank !== undefined ? personal : null}
      </Screen>
    );
  return (
    <Screen
      key={view.phaseId}
      className={`${styles.phoneScreen} ${groups.phone}`}
      title={view.phaseId === 'done' ? L('Final standings') : 'Kahoot!'}
    >
      {view.phaseId === 'done' ? (
        <>
          {view.me.role === 'player' ? personal : null}
          {(showStage && stage) || group ? (
            <PublicStandings
              rows={stage?.standings ?? view.standings ?? []}
              me={group?.myTeamId ?? view.me.id}
            />
          ) : null}
        </>
      ) : (
        <div className={styles.stageSummary}>
          {group ? (
            <>
              <h3>{L(groupTitle(group))}</h3>
              <GroupIntroRules group={group} />
              <GroupRoster group={group} players={view.players} mine={view.participating} />
            </>
          ) : null}
          <p>{L('First question coming up…')}</p>
          {view.paused ? <p>{L('Paused')}</p> : null}
        </div>
      )}
    </Screen>
  );
}
