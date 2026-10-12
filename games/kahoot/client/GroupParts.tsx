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

/** Shared footer scores come only from a publicly revealed team; hidden finals show a placeholder. */
export function GroupPlayerBar({ view }: { view: LightningControllerView }): JSX.Element | null {
  const L = useT(STRINGS);
  const group = view.group;
  if (!group || !view.participating) return null;
  const team = group.teams.find((candidate) => candidate.id === group.myTeamId);
  const player = view.players.find((candidate) => candidate.id === view.me.id);
  return (
    <div
      className={styles.playerBar}
      data-group-player-bar="true"
      role="status"
      aria-label={L('Player and team score')}
    >
      <b className={styles.barName}>{player?.name ?? L('You')}</b>
      <span>{team?.name ?? L(group.mode === 'tv-vote' ? 'The room' : 'Your team')}</span>
      <b
        className={styles.barScore}
        aria-label={
          team
            ? L(group.mode === 'teams' ? '{n} team points' : '{n} room points', { n: team.score })
            : undefined
        }
        aria-hidden={!team || undefined}
      >
        {team ? team.score : '—'}
      </b>
      {!team ? (
        <span className={styles.barPending}>
          {L(
            group.mode === 'teams' ? 'Team score after the podium' : 'Room score after the podium',
          )}
        </span>
      ) : null}
    </div>
  );
}

export function GroupStandings({
  view,
  gains = false,
}: {
  view: LightningTvView;
  gains?: boolean;
}): JSX.Element {
  const L = useT(STRINGS);
  return (
    <ol className={styles.groupBoard} data-group-scoreboard="vertical" aria-label={L('Standings')}>
      {(view.standings ?? []).map((row) => {
        const team = view.group?.teams.find((candidate) => candidate.id === row.playerId);
        return (
          <li key={row.playerId}>
            <b className={styles.boardRank}>#{row.rank}</b>
            <div className={styles.boardIdentity}>
              <b>{row.name}</b>
              <span className={styles.boardMembers}>
                {team?.members.map((id) => (
                  <span key={id}>
                    {view.players.find((player) => player.id === id)?.name ?? id}
                  </span>
                ))}
              </span>
            </div>
            <div className={styles.boardScore}>
              <b>{row.score}</b>
              {gains && row.delta !== undefined && row.delta > 0 ? <span>+{row.delta}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
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

export function GroupReceipt({
  view,
  besideTv = false,
}: {
  view: LightningControllerView;
  besideTv?: boolean;
}): JSX.Element | null {
  const L = useT(STRINGS);
  const group = view.group;
  if (!group) return null;
  const team = group.teams.find((candidate) => candidate.id === group.myTeamId);
  if (!team) return null;
  return (
    <div className={styles.receipt} role="status">
      <b>{team.name}</b>
      {besideTv ? (
        <p className={styles.receiptKind}>
          {L(group.mode === 'teams' ? 'Team results' : 'Room results')}
        </p>
      ) : null}
      {team.correctPercent !== undefined ? (
        <div className={styles.accuracy}>
          <span>{L('Correct')}</span>
          <meter
            min={0}
            max={100}
            value={team.correctPercent}
            aria-label={L('{n}% correct', { n: team.correctPercent })}
          />
          <b>{team.correctPercent}%</b>
        </div>
      ) : null}
      <strong className={styles.gained}>{L('+{n} points', { n: team.gained })}</strong>
      {!besideTv ? (
        <p className={styles.receiptTotal}>{L('{n} total', { n: team.score })}</p>
      ) : null}
      {group.mode === 'teams' ? (
        <p className={styles.receiptRule}>
          {L('Team points average players who stayed or answered')}
        </p>
      ) : null}
    </div>
  );
}

export function GroupVerdict({
  view,
  besideTv = false,
}: {
  view: LightningControllerView;
  besideTv?: boolean;
}): JSX.Element {
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
    <div
      className={styles.verdict}
      data-stage={view.showStage || view.phoneOnly || undefined}
      data-beside-tv={besideTv || undefined}
      role="status"
    >
      <h3>
        <span
          className={styles.outcomeMark}
          data-correct={outcome?.correct || undefined}
          aria-hidden="true"
        >
          {outcome?.correct ? '✓' : '✕'}
        </span>
        {L(verdict)}
      </h3>
      {vote ? (
        <p>
          {view.myPickIndex === null
            ? L('You did not vote')
            : L('Your vote: {shape}', { shape: L(SHAPES[view.myPickIndex] ?? '') })}
        </p>
      ) : (
        <p>{L('+{n} personal points', { n: outcome?.delta ?? 0 })}</p>
      )}
      <GroupReceipt view={view} besideTv={besideTv} />
      {besideTv && view.myRank !== undefined ? (
        <p className={styles.rankStatus}>
          {L(vote ? 'The room is in place {rank}' : 'Your team is in place {rank}', {
            rank: view.myRank,
          })}
        </p>
      ) : null}
      {view.round?.last ? <p>{L('The podium is next')}</p> : null}
    </div>
  );
}
