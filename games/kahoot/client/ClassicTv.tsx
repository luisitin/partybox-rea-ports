// Classic mode uses public stage data; the wager presentation remains independently routed.
import type { JSX } from 'react';
import { Stage, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameTvProps } from '@partybox/game-sdk/ui';
import type { LightningTvView } from '../server/views';
import {
  ClassicChart,
  Podium,
  PublicStandings,
  QuestionOptions,
  podiumLabel,
} from './ClassicParts';
import { STRINGS } from './strings';
import styles from './Classic.module.css';
import { TvNext, useStandingsUp } from './NextStep';
import { useStandingsCue } from './useRevealCue';

export function ClassicTv({ view, skip }: GameTvProps<LightningTvView>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(100, view.paused, view.clockHeldAt);
  useStandingsCue(view);
  const nextUp = useStandingsUp(
    view.phaseId === 'reveal' ? view.deadline : null,
    view.revealAt,
    view.paused,
    view.clockHeldAt,
    view.nextAt ?? view.leaderboardAt,
  );
  const round = L('Question {n} of {m}', { n: view.round?.number ?? 0, m: view.round?.total ?? 0 });
  const leaderboard =
    view.phaseId === 'reveal' && view.leaderboardAt !== undefined && now >= view.leaderboardAt;
  return (
    <Stage className={styles.stage}>
      <div className={styles.tvPage} data-phase={view.phaseId}>
        {view.phaseId === 'intro' ? (
          <div className={styles.intro}>
            <h2>Kahoot!</h2>
            <p>
              {view.categoryLabel} · {L('faster is worth more')}
            </p>
            {view.paused ? <p>{L('Paused')}</p> : null}
          </div>
        ) : null}
        {view.phaseId === 'question' && view.question ? (
          <>
            <header className={styles.tvHeader}>
              <div>
                <p>{round}</p>
                <p>{L('{n} of {m} answered', { n: view.answeredCount, m: view.totalCount })}</p>
              </div>
            </header>
            <h2 className={styles.tvPrompt}>{view.question.text}</h2>
            <QuestionOptions question={view.question} />
          </>
        ) : null}
        {view.phaseId === 'reveal' ? (
          <>
            <header className={styles.tvHeader}>
              <p>{round}</p>
              {view.paused ? <p>{L('Paused')}</p> : null}
              {nextUp && view.next && skip ? (
                <TvNext
                  next={view.next}
                  skip={skip}
                  vipName={view.players.find((player) => player.id === view.vip)?.name}
                />
              ) : null}
            </header>
            {leaderboard ? (
              <>
                <h2 className={styles.headline}>{L('Scoreboard')}</h2>
                <PublicStandings rows={view.standings ?? []} gains />
              </>
            ) : (
              <>
                <p className={styles.asked}>{view.question?.text}</p>
                <ClassicChart view={view} />
              </>
            )}
          </>
        ) : null}
        {view.phaseId === 'podium' ? (
          <>
            <p className={styles.kicker}>{L('The podium')}</p>
            <h2 className={styles.headline}>{L(podiumLabel(view.podium?.rank ?? 1))}</h2>
            {view.paused ? <p>{L('Paused')}</p> : null}
            <Podium view={view} />
          </>
        ) : null}
        {view.phaseId === 'done' ? (
          <>
            <h2 className={styles.headline}>{L('Final standings')}</h2>
            <PublicStandings rows={view.standings ?? []} />
          </>
        ) : null}
      </div>
    </Stage>
  );
}
