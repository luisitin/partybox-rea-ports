// TV view for Lightning Round. Dumb component: renders `view`, composes game-sdk primitives, never
// touches sockets or game logic. The shell already shows the timer, player chips and VIP overlay.
import type { CSSProperties, JSX, ReactNode } from 'react';
import { BigText, Scoreboard, Stage, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { LightningTvView } from '../server/index';
import { difficultyText, drawText } from './labels';
import { STRINGS } from './strings';
import { FinalReveal } from './TvFinal';
import { TvNext, useStandingsUp } from './NextStep';
import { AnswerCard, RevealRows, RoundHeader, TvQuestion } from './TvQuestion';
import { AnswerChart } from './AnswerChart';
import { useStandingsCue } from './useRevealCue';
import styles from './Tv.module.css';
import { ClassicTv } from './ClassicTv';

export function Tv(props: GameTvProps<LightningTvView>): JSX.Element {
  return props.view.quizMode === 'classic' ? <ClassicTv {...props} /> : <WagerTv {...props} />;
}

/** Inline bolt (precedent: game-sdk Avatar), currentColor so every theme's accent-2 paints it. */
function Bolt(): JSX.Element {
  return (
    <svg className={styles.bolt} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M37 3 12 37h17l-4 24 27-34H35z" fill="currentColor" />
    </svg>
  );
}

/** A translated sentence with a `{topic}` slot, the slot filled with styled words. */
function withTopic(text: string, topic: ReactNode): JSX.Element {
  const [before, after] = text.split('{topic}');
  return (
    <>
      {before}
      {topic}
      {after}
    </>
  );
}

function WagerTv({ view, skip }: GameTvProps<LightningTvView>): JSX.Element {
  const L = useT(STRINGS);
  const standings = view.standings ?? [];
  useStandingsCue(view);
  const standingsUp = useStandingsUp(
    view.phaseId === 'reveal' ? view.deadline : null,
    view.revealAt,
    view.paused,
    view.clockHeldAt,
    view.leaderboardAt,
  ); // I-589
  if (view.phaseId === 'intro') {
    // ADR-053: a 2 s title beat after the shell's stage (which showed the rules): bolt + title
    // ride the shell's phase rise, the topic pill follows one beat later.
    return (
      <Stage center>
        <Bolt />
        <BigText level="display" tone="accent">
          Kahoot!
        </BigText>
        <div className={styles.introLine} style={{ '--i': 1 } as CSSProperties}>
          <span className={styles.introPill}>
            {drawText(view.categoryLabel, L)} · {L('faster is worth more')}
          </span>
        </div>
      </Stage>
    );
  }
  if (view.phaseId === 'question') {
    return (
      <Stage>
        <div className={styles.page}>
          <TvQuestion
            round={view.round}
            question={view.question}
            answeredCount={view.answeredCount}
            totalCount={view.totalCount}
            players={view.players}
          />
        </div>
      </Stage>
    );
  }
  if (view.phaseId === 'reveal') {
    if (view.round?.final && view.question && view.correctIndex !== undefined) {
      return (
        <Stage>
          {/* Same size container as the question page: a four-row roster leaves too little for
              four rows of two-line bet cards, so below 560 px the reveal compacts. */}
          <div className={styles.page}>
            <div className={styles.fit}>
              <FinalReveal
                key={`${view.round.number}/${view.revealAt ?? ''}`}
                question={view.question}
                correctIndex={view.correctIndex}
                rows={view.rows ?? []}
                startedAt={view.revealAt}
                paused={view.paused}
                clockHeldAt={view.clockHeldAt}
              />
            </div>
          </div>
        </Stage>
      );
    }
    return (
      <Stage>
        <RoundHeader
          round={view.round}
          question={view.question}
          // I-589: the owner's Next button, with the standings
          aside={
            standingsUp && view.next && skip ? (
              <TvNext
                next={view.next}
                skip={skip}
                vipName={view.players.find((p) => p.id === view.vip)?.name}
              />
            ) : null
          }
        />
        <div className={styles.revealSummary}>
          <p className={styles.asked}>{view.question?.text ?? '…'}</p>
          {view.question && view.correctIndex !== undefined && view.answerDistribution ? (
            <AnswerChart
              question={view.question}
              correctIndex={view.correctIndex}
              distribution={view.answerDistribution}
            />
          ) : null}
        </div>
        {view.question && view.correctIndex !== undefined ? (
          <AnswerCard question={view.question} correctIndex={view.correctIndex} />
        ) : null}
        <RevealRows
          rows={view.rows ?? []}
          startedAt={view.revealAt}
          paused={view.paused}
          clockHeldAt={view.clockHeldAt}
          leaderboardAt={view.leaderboardAt}
        />
      </Stage>
    );
  }
  if (view.phaseId === 'wager') {
    const gap = standings.length >= 2 ? standings[0]!.score - standings[1]!.score : 0;
    return (
      <Stage>
        <div className={styles.header}>
          <span className={`${styles.kicker} ${styles.final}`}>{L('Final question next')}</span>
          <span className={styles.placed} role="status">
            <span key={view.answeredCount} className={styles.countNum}>
              {view.answeredCount} / {view.totalCount}
            </span>{' '}
            {L('placed')}
          </span>
        </div>
        {/* T-0175: the heading, the topic and the rules read as one block, so the board below
            keeps clear of the TV's bottom 5 % */}
        <div className={styles.wagerHead}>
          <BigText level="h2">{L('Place your wagers')}</BigText>
          {/* I-550 A: the bet is on a topic the room can see; T-0175: at body size, the topic
              itself in white and only the difficulty in the accent (the whole h2 line in yellow
              was hard to read) */}
          {view.finalTopic ? (
            <p className={styles.finalTopic}>
              {withTopic(
                L('Final question: {topic}'),
                <>
                  {L.sent(view.finalTopic.categoryLabel)} ·{' '}
                  <strong>{L.sent(view.finalTopic.subcategoryLabel)}</strong> ·{' '}
                  <strong className={styles.finalLevel}>
                    {difficultyText(view.finalTopic.difficulty, L)}
                  </strong>
                </>,
              )}
            </p>
          ) : null}
          <p className={`pb-muted pb-caption ${styles.rules}`}>
            {L('Right answer wins the bet · wrong answer loses it')}
            {gap > 0 ? ` · ${L('{name} leads by {gap}', { name: standings[0]!.name, gap })}` : ''}
          </p>
        </div>
        <Scoreboard
          rows={standings}
          noTrophy
          // T-0175: four h2 rows in one column ran into the overscan; two columns of two use the width
          dense={standings.length >= 4}
          // Six h2 rows per column plus this header overflow 1080 px (review-loop #53); once the
          // roster is three rows (9+), even six small rows run into the host bar, and four rows
          // (13+) leave room for four rows of standings only: four columns.
          size={standings.length >= 9 ? 'sm' : 'md'}
          columns={standings.length >= 13 ? 4 : standings.length >= 9 ? 3 : 2}
          markIds={view.players.filter((p) => p.status === 'submitted').map((p) => p.id)}
          stagger="down"
        />
      </Stage>
    );
  }
  return (
    <Stage>
      <BigText level="h1" tone="accent">
        {L("That's the round!")}
      </BigText>
      <Scoreboard rows={standings} stagger="up" />
    </Stage>
  );
}
