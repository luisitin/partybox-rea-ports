// Public group displays use only the server's already revealed teams, never inferred winners.
import type { JSX } from 'react';
import { useT } from '@partybox/game-sdk/ui';
import type { LightningControllerView, LightningTvView } from '../server/views';
import { SHAPES, Shape, choiceClass } from './ClassicParts';
import { STRINGS } from './strings';
import styles from './Group.module.css';

type Group = NonNullable<LightningTvView['group']>;
type Players = LightningTvView['players'];

export function groupTitle(group: Group): string {
  return group.mode === 'teams' ? 'Teams' : 'Room vote';
}

export function GroupRoster({
  group,
  players,
  mine = false,
}: {
  group: Group;
  players: Players;
  mine?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  const teams =
    mine && group.myTeamId ? group.teams.filter((team) => team.id === group.myTeamId) : group.teams;
  return (
    <ul
      className={styles.roster}
      data-count={teams.length}
      data-mine={mine || undefined}
      aria-label={L('Teams and players')}
    >
      {teams.map((team) => (
        <li key={team.id} data-mine={team.id === group.myTeamId || undefined}>
          <b>{team.name}</b>
          <span className={styles.members}>
            {team.members.map((id) => (
              <span key={id}>{players.find((player) => player.id === id)?.name ?? id}</span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function GroupIdentity({ group }: { group: Group }): JSX.Element {
  const L = useT(STRINGS);
  const team = group.teams.find((candidate) => candidate.id === group.myTeamId);
  return <p className={styles.identity}>{team?.name ?? L(groupTitle(group))}</p>;
}

export function GroupDecision({ view }: { view: LightningTvView }): JSX.Element | null {
  const L = useT(STRINGS);
  const group = view.group;
  if (!group || group.mode !== 'tv-vote' || view.phaseId !== 'reveal') return null;
  const decision = group.decision;
  return (
    <p className={styles.decision} role="status">
      {decision === undefined ? (
        L('No room answer — nobody voted')
      ) : (
        <>
          <span>{L('Room answer:')}</span>
          <span className={`${styles.decisionMark} ${choiceClass(decision)}`}>
            <Shape index={decision} className={styles.mark} />
          </span>
          <b>{view.question?.choices[decision] ?? L(SHAPES[decision] ?? '')}</b>
          <span>{decision === view.correctIndex ? L('✓ Correct') : L('Wrong')}</span>
        </>
      )}
    </p>
  );
}

export function GroupReceipt({ view }: { view: LightningControllerView }): JSX.Element | null {
  const L = useT(STRINGS);
  const group = view.group;
  if (!group) return null;
  const team = group.teams.find((candidate) => candidate.id === group.myTeamId);
  if (!team) return null;
  return (
    <div className={styles.receipt} role="status">
      <b>{team.name}</b>
      <p>
        {L('+{n} points', { n: team.gained })} · {L('{n} total', { n: team.score })}
      </p>
      {group.mode === 'teams' ? (
        <p>{L('Team points average every member’s contribution')}</p>
      ) : null}
    </div>
  );
}

export function GroupVerdict({ view }: { view: LightningControllerView }): JSX.Element {
  const L = useT(STRINGS);
  const vote = view.group?.mode === 'tv-vote';
  const outcome = view.outcome;
  const verdict = vote
    ? outcome?.correct
      ? 'The room got it right!'
      : view.group?.decision === undefined
        ? 'No room answer'
        : 'The room got it wrong'
    : outcome?.correct
      ? 'Correct!'
      : outcome?.answered
        ? 'Wrong'
        : 'Too slow';
  return (
    <div className={styles.verdict} role="status">
      <h3>{L(verdict)}</h3>
      {vote ? (
        <p>
          {view.myPickIndex === null
            ? L('You did not vote')
            : L('Your vote: {shape}', { shape: L(SHAPES[view.myPickIndex] ?? '') })}
        </p>
      ) : (
        <p>{L('+{n} personal points', { n: outcome?.delta ?? 0 })}</p>
      )}
      <GroupReceipt view={view} />
      {view.round?.last ? <p>{L('The podium is next')}</p> : null}
    </div>
  );
}
