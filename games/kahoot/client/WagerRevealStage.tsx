// The phone stage separates answer/chart and standings beats so sixteen seats fit one look.
import type { JSX } from 'react';
import { ContentLang, Screen, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { LightningControllerView } from '../server/views';
import { AnswerChart } from './AnswerChart';
import { PublicStandings } from './ClassicParts';
import { Outcome } from './ControllerBits';
import { PhoneNext } from './NextStep';
import { useRevealBeat } from './reveal-clock';
import { FINAL_REVEAL_HOLD_MS, REVEAL_BEAT_MS, finalTotalsDelay } from './timing';
import { STRINGS } from './strings';
import styles from './WagerRevealStage.module.css';

export function WagerRevealStage({
  view,
  skip,
  streakBefore = 0,
}: {
  view: LightningControllerView;
  skip?: () => void;
  streakBefore?: number;
}): JSX.Element {
  const L = useT(STRINGS);
  const stage = view.stage;
  const question = stage?.question ?? view.question;
  const correct = stage?.correctIndex ?? view.correctIndex;
  const rows = stage?.rows ?? view.rows ?? [];
  const final = view.round?.final === true;
  const now = useServerNow(100, view.paused, view.clockHeldAt);
  const verdict = useRevealBeat(
    view.deadline,
    view.revealAt,
    final ? FINAL_REVEAL_HOLD_MS : REVEAL_BEAT_MS,
    view.paused,
    view.clockHeldAt,
  );
  const totals = useRevealBeat(
    view.deadline,
    view.revealAt,
    finalTotalsDelay(rows.length),
    view.paused,
    view.clockHeldAt,
  );
  const boardAt = stage?.leaderboardAt ?? view.leaderboardAt;
  const board = !final && boardAt !== undefined && now >= boardAt;
  const round = final
    ? L('Final question')
    : L('Question {n} of {m}', { n: view.round?.number ?? 0, m: view.round?.total ?? 0 });
  return (
    <Screen
      className={styles.screen}
      title={round}
      footer={
        view.participating && skip && view.next ? (
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
        ) : undefined
      }
    >
      {view.paused ? <p className={styles.status}>{L('Paused')}</p> : null}
      {view.participating && verdict ? (
        <Outcome view={view} streakBefore={streakBefore} />
      ) : view.participating ? (
        <p className={styles.status}>{L('The answer is coming…')}</p>
      ) : null}
      {board ? (
        <>
          <h3 className={styles.heading}>{L('Scoreboard')}</h3>
          <div className={styles.standings}>
            <PublicStandings rows={stage?.standings ?? view.standings ?? []} me={view.me.id} />
          </div>
        </>
      ) : (
        <>
          {question && !(final && totals) ? (
            <>
              <h3 className={styles.prompt}>{question.text}</h3>
              <ContentLang content={view.questionLang} className={styles.language} />
            </>
          ) : null}
          {verdict && question && correct !== undefined ? (
            <p className={styles.answer}>
              <b>
                {L('Correct answer')}: {'ABCD'[correct]} · {question.choices[correct]}
              </b>
            </p>
          ) : !view.participating ? (
            <p className={styles.status}>{L('The answer is coming…')}</p>
          ) : null}
          {!final && verdict && question && correct !== undefined && stage?.answerDistribution ? (
            <div className={styles.chart}>
              <AnswerChart
                question={question}
                correctIndex={correct}
                distribution={stage.answerDistribution}
              />
            </div>
          ) : null}
          {final && totals ? (
            <>
              <p className={styles.legend}>{L('Bet · change · total')}</p>
              <ol className={styles.results} aria-label={L("everyone's results")}>
                {rows.map((row) => (
                  <li
                    key={row.playerId}
                    data-me={row.playerId === view.me.id || undefined}
                    aria-label={`${row.name} · ${row.correct ? L('Correct!') : row.pickIndex === null ? L('No answer') : L('Wrong')} · ${L('Bet')}: ${row.wagerAmount ?? 0} · ${row.delta >= 0 ? '+' : '−'}${Math.abs(row.delta)} · ${L('{n} points', { n: row.score })}`}
                  >
                    <b>{row.name}</b>
                    <span aria-hidden="true">
                      {row.correct ? '✓' : row.pickIndex === null ? '—' : '✗'}{' '}
                      {row.wagerAmount ?? 0} · {row.delta >= 0 ? '+' : '−'}
                      {Math.abs(row.delta)} · {row.score}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
