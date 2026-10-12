import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { QuizControllerView, QuizTvView } from '../server/views';
import { SHAPES } from './QuestionParts';
import { STRINGS } from './strings';
import styles from './Teams.module.css';

export function TeamHeader({ view }: { view: QuizControllerView }): JSX.Element | null {
  const L = useT(STRINGS);
  return view.team ? (
    <p className={styles.identity}>
      <b>{view.team.name}</b>
      <span>{view.mode === 'tv-vote' ? L('One answer · shared score') : L('Your team')}</span>
    </p>
  ) : null;
}

export function TeamRoster({ view }: { view: QuizTvView }): JSX.Element | null {
  const L = useT(STRINGS);
  return view.mode === 'teams' ? (
    <div className={styles.roster} aria-label={L('Teams')}>
      {view.teams.map((team) => (
        <section key={team.id}>
          <h3>{team.name}</h3>
          <p>
            {team.members
              .map((id) => view.players.find((p) => p.id === id)?.name ?? id)
              .join(' · ')}
          </p>
        </section>
      ))}
    </div>
  ) : null;
}

export function TeamReceipt({ view }: { view: QuizControllerView }): JSX.Element | null {
  const L = useT(STRINGS);
  if (!view.verdict || !view.team) return null;
  const correct = view.verdict.outcome === 'correct';
  const title =
    view.mode === 'tv-vote'
      ? correct
        ? L('Room correct!')
        : view.verdict.outcome === 'timeout'
          ? L('No votes')
          : L('Room missed it')
      : correct
        ? L('Your answer: correct!')
        : view.verdict.outcome === 'timeout'
          ? L('Your answer: too slow')
          : L('Your answer: missed');
  return (
    <div className={styles.receipt} data-correct={correct || undefined} role="status">
      <h3>
        {correct ? '✓ ' : '× '}
        {title}
      </h3>
      {view.mode === 'teams' ? (
        <p>{L('Your answer earned {n} points', { n: view.verdict.points })}</p>
      ) : null}
      {view.mode === 'tv-vote' && view.decision !== null ? (
        <p>{L('Room chose {shape}', { shape: L(SHAPES[view.decision] ?? 'Triangle') })}</p>
      ) : null}
      <b>{L('{team}: +{n} team points', { team: view.team.name, n: view.team.gained })}</b>
      <p>
        {L('{n} total', { n: view.team.score })}
        {view.rank > 0 ? ` · ${L('Team place {rank}', { rank: view.rank })}` : ''}
      </p>
    </div>
  );
}
