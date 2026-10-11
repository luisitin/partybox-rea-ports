import type { JSX } from 'react';
import { usePhoneOnly, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { DinoDashControllerView } from '../server/index';
import type { Input } from '../server/world';
import { Controls } from './Controls';
import { clockText, raceTime, runnerMetres, slotStyle, standingsRows } from './display';
import { Race, RaceLane, RunnerIcon } from './Race';
import { Standings } from './Standings';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<DinoDashControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const stage = phoneOnly || view.stage;
  const now = useServerNow(33, view.paused, view.clockHeldAt);
  const playing = view.phaseId === 'play';
  const player = view.me.role === 'player';
  const alive = playing && player && view.alive;
  const t = raceTime(view, now, playing && !view.paused);
  const runner = view.runners.find((r) => r.id === view.me.id);
  const name = view.players.find((p) => p.id === view.me.id)?.name ?? '';
  const rows = standingsRows(view);
  const own = rows.find((row) => row.id === view.me.id);
  const leaders = rows.filter((row) => row.rank === 1);
  const survivors = view.runners.filter((r) => r.died === null).length;
  const total = view.scores[view.me.id] ?? 0;
  const ownLane = runner ? (
    <div className={styles.ownLane}>
      <RaceLane
        runner={runner}
        obstacles={view.obstacles}
        t={t}
        slot={view.slot}
        name={name}
        close
      />
    </div>
  ) : null;
  const roundLine = (
    <p className={styles.round}>
      {L('Round {n} of {m}', { n: view.round, m: view.rounds })}
      <span role="timer" aria-label={L('Time left')}>
        {clockText(view.endsAt - now)}
      </span>
    </p>
  );

  if (alive)
    return (
      <div
        className={styles.screen}
        style={slotStyle(view.slot)}
        data-stage={stage ? 'true' : undefined}
      >
        <header className={styles.identity}>
          <RunnerIcon slot={view.slot} />
          <div>
            <h2>{L('Lane {n} · {name}', { n: view.slot + 1, name })}</h2>
            <p>{L('{n} m', { n: runner ? runnerMetres(runner, t) : view.distance })}</p>
          </div>
        </header>
        {roundLine}
        {ownLane}
        {stage ? <LiveProgress view={view} t={t} /> : null}
        {view.paused ? (
          <p className={styles.paused} role="status">
            {L('Paused')}
          </p>
        ) : (
          <Controls key={view.round} send={send} />
        )}
        <p className={styles.hint}>{L('Rocks: jump · Birds: hold duck')}</p>
      </div>
    );

  let headline: string;
  let personal = '';
  if (playing) {
    headline = player ? L('You crashed') : L('Watch the race');
    personal = player
      ? L('{n} m this run', { n: view.distance })
      : L('{n} still running', { n: survivors });
  } else if (view.phaseId === 'score') {
    headline = L('Round {n} complete', { n: view.round });
    if (player && own)
      personal = own.tied
        ? L('Rank {rank}, tied · +{n} m · {m} m total', {
            rank: own.rank,
            n: view.lastPoints[view.me.id] ?? 0,
            m: total,
          })
        : L('Rank {rank} · +{n} m · {m} m total', {
            rank: own.rank,
            n: view.lastPoints[view.me.id] ?? 0,
            m: total,
          });
  } else {
    headline =
      leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('Shared winners!');
    if (player && own)
      personal = own.tied
        ? L('Your rank: {n}, tied · {m} m', { n: own.rank, m: total })
        : L('Your rank: {n} · {m} m', { n: own.rank, m: total });
  }
  return (
    <div className={styles.stage} style={slotStyle(view.slot)} data-phase={view.phaseId}>
      <header>
        <h2>{headline}</h2>
        {personal ? <p className={styles.personal}>{personal}</p> : null}
      </header>
      {playing ? roundLine : <p className={styles.round}>{L('Equal metres share a rank')}</p>}
      {playing ? <Race view={view} t={t} meId={view.me.id} /> : ownLane}
      {!playing ? (
        <>
          <p className={styles.boardLabel}>{L('Round + · Total metres')}</p>
          <Standings view={view} meId={view.me.id} />
        </>
      ) : null}
      <p className={styles.hint}>
        {playing
          ? L('{n} of {m} still running', { n: survivors, m: view.runners.length })
          : view.phaseId === 'score' && view.round < view.rounds
            ? L('Next run: a fresh course for everyone')
            : L('Highest total distance wins')}
      </p>
    </div>
  );
}

function LiveProgress({ view, t }: { view: DinoDashControllerView; t: number }): JSX.Element {
  const L = useT(STRINGS);
  return (
    <ul className={styles.progress} aria-label={L('Live distances')}>
      {view.runners.map((runner, slot) => (
        <li key={runner.id} style={slotStyle(slot)}>
          <span>
            <b>{slot + 1}</b> {view.players.find((p) => p.id === runner.id)?.name ?? runner.id}
          </span>
          <strong>
            {runner.died !== null
              ? L('OUT · {n} m', { n: runnerMetres(runner, t) })
              : L('{n} m', { n: runnerMetres(runner, t) })}
          </strong>
        </li>
      ))}
    </ul>
  );
}
