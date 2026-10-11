// The phone always shows a playable course. Phone-only spectators get the public stage and all standings.
import type { JSX } from 'react';
import { usePhoneOnly, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { ClimbControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Climb } from './Climb';
import { climbRows, clockText, playerStyle } from './display';
import { STRINGS } from './strings';
import { useSteering } from './useSteering';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<ClimbControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const phase = view.phaseId;
  const mine = view.mine;
  const player = view.me.role === 'player';
  const steering =
    phase === 'play' && player && mine !== null && mine.died === null && !view.paused;
  const controls = useSteering(steering, `${phase}:${view.round}`, send);
  const rows = climbRows(view, phase === 'score' || phase === 'done');
  const myRow = rows.find((r) => r.id === view.me.id);
  const slot = myRow?.slot ?? 0;
  const best = Math.max(0, ...rows.map((r) => r.total));
  const leaders = rows.filter((r) => r.total === best);
  const left = Math.max(0, (view.deadline ?? view.endsAt) - now);
  const byHeight = [...view.climbers].sort((a, b) => b.peak - a.peak);
  const watching = player && mine ? mine : byHeight[0];
  const watchingRow = rows.find((r) => r.id === watching?.id);
  const title =
    phase === 'done'
      ? leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the top!')
      : phase === 'score'
        ? L('Round {n} over', { n: view.round })
        : phase === 'ready'
          ? L('Fresh start — get ready')
          : player && mine?.died != null
            ? L('You fell — height saved')
            : player
              ? L('Hold a side to steer')
              : L('Highest climb wins');
  const hint =
    phase === 'play'
      ? player && mine?.died != null
        ? L('You return next round.')
        : L('Bounce is automatic. Land on the platforms.')
      : phase === 'ready'
        ? L('Same course for everyone. Bounce is automatic.')
        : player
          ? view.rank !== null
            ? L('{n} total height · Place {rank}', { n: myRow?.total ?? 0, rank: view.rank })
            : L('+{n} this round · {m} total height', {
                n: view.lastPoints[view.me.id] ?? 0,
                m: myRow?.total ?? 0,
              })
          : L('Height this round adds to the total.');
  const showRows = !steering;
  return (
    <section
      className={styles.screen}
      style={playerStyle(slot)}
      data-standings={showRows ? 'true' : undefined}
    >
      <header className={styles.header}>
        <div className={styles.meta}>
          <span>{L('Round {n} of {m}', { n: view.round, m: view.rounds })}</span>
          {phase === 'play' || phase === 'ready' ? (
            <span role="timer">
              {phase === 'ready'
                ? L('Starts in {n}', { n: Math.max(1, Math.ceil(left / 1000)) })
                : clockText(left)}
            </span>
          ) : null}
        </div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.hint}>{hint}</p>
      </header>
      {watching ? (
        <div className={styles.course} style={playerStyle(watchingRow?.slot ?? slot)}>
          <div className={styles.scene}>
            <Climb
              climber={watching}
              platforms={view.platforms}
              slot={watchingRow?.slot ?? slot}
              label={L('{name}: height {n}', {
                name: watchingRow?.name ?? '',
                n: Math.floor(watching.peak),
              })}
            />
            {watching.died !== null ? <span className={styles.out}>{L('Out')}</span> : null}
          </div>
          <p className={styles.height}>
            <span>
              {player ? L('Your height') : L('{name} · Height', { name: watchingRow?.name ?? '' })}
            </span>
            <b>{Math.floor(watching.peak)}</b>
          </p>
        </div>
      ) : null}
      {steering ? (
        <>
          <div className={styles.pads} role="group" aria-label={L('Steering')}>
            {(['left', 'right'] as const).map((side) => (
              <button
                type="button"
                key={side}
                className={styles.pad}
                aria-pressed={controls[side]}
                aria-label={
                  side === 'left' ? L('Hold left to steer left') : L('Hold right to steer right')
                }
                data-held={controls[side] ? 'true' : undefined}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  controls.hold(side, true, `pointer:${event.pointerId}`);
                }}
                onPointerUp={(event) => controls.hold(side, false, `pointer:${event.pointerId}`)}
                onPointerCancel={(event) =>
                  controls.hold(side, false, `pointer:${event.pointerId}`)
                }
                onLostPointerCapture={(event) =>
                  controls.hold(side, false, `pointer:${event.pointerId}`)
                }
                onBlur={controls.release}
                onKeyDown={(event) => {
                  if (event.key !== ' ' && event.key !== 'Enter') return;
                  event.preventDefault();
                  controls.hold(side, true, `button:${side}`);
                }}
                onKeyUp={(event) => {
                  if (event.key !== ' ' && event.key !== 'Enter') return;
                  event.preventDefault();
                  controls.hold(side, false, `button:${side}`);
                }}
              >
                <span className={styles.arrow} aria-hidden="true">
                  {side === 'left' ? '←' : '→'}
                </span>
                <b>{side === 'left' ? L('Hold left') : L('Hold right')}</b>
              </button>
            ))}
          </div>
          <p className={styles.tip}>{L('Edges wrap. Springs boost you higher.')}</p>
        </>
      ) : (
        <ul className={styles.rows} aria-label={L('Standings')}>
          {rows.map((r) => (
            <li
              key={r.id}
              style={playerStyle(r.slot)}
              data-me={r.id === view.me.id ? 'true' : undefined}
            >
              <span className={styles.slot}>{r.slot + 1}</span>
              <b className={styles.name}>{r.name}</b>
              {phase === 'play' && r.out ? (
                <span className={styles.rowState}>{L('Out')}</span>
              ) : null}
              <span className={styles.points}>
                {phase === 'play' || phase === 'ready' ? r.height : r.total}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!steering && !phoneOnly && !player ? (
        <p className={styles.tip}>{L('Watch the climbs here or on the TV.')}</p>
      ) : null}
    </section>
  );
}
