// The phone always carries the same mover as the TV: one precise alignment view, one native action.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { buzz, usePhoneOnly, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { SkylineControllerView } from '../server/index';
import { RESTART_MS } from '../server/types';
import { DROP_MS, GROW_STREAK, MAX_HEIGHT } from '../server/world';
import type { Input } from '../server/world';
import { Roster } from './Roster';
import { Tower } from './Tower';
import { clockText, feedbackKey, seatStyle, slotOf } from './display';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<SkylineControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const play = useSound();
  const phoneOnly = usePhoneOnly();
  const stage = phoneOnly || view.stage;
  const now = useServerNow(50, view.paused, view.clockHeldAt);
  const tower = view.tower;
  const player = view.me.role === 'player' && tower !== null;
  const active = view.phaseId === 'play';
  const left = Math.max(0, view.endsAt - now);
  const slot = slotOf(view.slots, view.me.id);
  const myName = view.players.find((p) => p.id === view.me.id)?.name ?? '';
  const eventKey = tower
    ? `${tower.attempt}:${tower.lastAt}:${tower.height}:${tower.crashedAt}`
    : '';
  const heard = useRef(eventKey);
  useEffect(() => {
    if (heard.current === eventKey) return;
    heard.current = eventKey;
    if (!tower || !active || view.paused || !player) return;
    if (tower.feedback === 'perfect' || tower.feedback === 'grow') {
      play('correct', { quiet: true });
      buzz([30, 40, 30]);
    } else if (tower.feedback === 'trim') {
      play('clack', { quiet: true });
      buzz(12);
    } else if (tower.feedback === 'miss') {
      play('wrong');
      buzz(120);
    }
  }, [eventKey, tower, active, player, play, view.paused]);

  // Attempt and floor identify an action. A short wait also makes a rejected early packet retryable.
  const actionKey = tower ? `${tower.attempt}:${tower.height}:${tower.crashedAt}` : '';
  const sent = useRef({ key: '', at: 0 });
  const [request, setRequest] = useState({ key: '', at: 0 });
  const missing = tower?.crashedAt != null;
  const readyAt = tower
    ? tower.crashedAt === null
      ? tower.movingSince + DROP_MS
      : tower.crashedAt + RESTART_MS
    : 0;
  const pending = request.key === actionKey && now < request.at + DROP_MS;
  const finishedTower = tower !== null && tower.height >= MAX_HEIGHT;
  const disabled =
    !player || !active || !!view.paused || left === 0 || now < readyAt || pending || finishedTower;
  const act = (): void => {
    if (!tower || disabled || (sent.current.key === actionKey && now < sent.current.at + DROP_MS))
      return;
    const packet = { key: actionKey, at: now };
    sent.current = packet;
    setRequest(packet);
    send(
      tower.crashedAt === null
        ? { type: 'drop', attempt: tower.attempt, level: tower.height }
        : { type: 'restart', attempt: tower.attempt },
    );
  };

  if (!active) {
    const top = Math.max(0, ...Object.values(view.scores));
    const leaders = view.players.filter((p) => (view.scores[p.id] ?? 0) === top);
    const headline =
      leaders.length === 1
        ? L('{name} built the tallest tower!', { name: leaders[0]?.name ?? '' })
        : L('A tie at the skyline!');
    const rank =
      view.rank ??
      1 + Object.values(view.scores).filter((score) => score > (tower?.best ?? 0)).length;
    return (
      <div className={styles.results} style={seatStyle(slot)}>
        <header className={styles.resultHeader}>
          <h2>{headline}</h2>
          <p>
            {player
              ? L('You placed {rank} · Best {n} floors', { rank, n: tower?.best ?? 0 })
              : L('Best height wins · {n} floors at the top', { n: top })}
          </p>
        </header>
        {tower ? (
          <div className={styles.finalArt}>
            <Tower
              tower={tower}
              now={view.checked}
              course={view.course}
              active={false}
              best
              name={myName}
            />
          </div>
        ) : (
          <p className={styles.spectatorNote}>{L('The skyline is complete')}</p>
        )}
        <Roster
          players={view.players}
          scores={view.scores}
          slots={view.slots}
          towers={view.towers}
          mine={view.me.id}
          ranked
        />
      </div>
    );
  }

  if (!player) {
    const leader = [...(view.towers ?? [])].sort((a, b) => b.best - a.best)[0];
    const leaderName = view.players.find((p) => p.id === leader?.id)?.name ?? '';
    const leaderSlot = slotOf(view.slots, leader?.id ?? '');
    return (
      <div className={styles.spectator} style={seatStyle(leaderSlot)}>
        <header className={styles.top}>
          <h2>{L('Skyline Stack')}</h2>
          <p className={styles.time}>{clockText(left)}</p>
        </header>
        {leader ? (
          <div className={styles.visual}>
            <Tower
              tower={leader}
              now={Math.min(now, view.endsAt)}
              course={view.course}
              active
              name={leaderName}
            />
          </div>
        ) : (
          <p className={styles.spectatorNote}>{L('Watch the towers compete')}</p>
        )}
        <h3 className={styles.rosterTitle}>{L('Room best heights')}</h3>
        <Roster
          players={view.players}
          scores={view.scores}
          slots={view.slots}
          towers={view.towers}
          mine=""
        />
      </div>
    );
  }

  const feedback = finishedTower
    ? L('Maximum skyline reached!')
    : tower.crashedAt !== null
      ? L.sent(feedbackKey('miss'))
      : now - tower.lastAt < 1000 && tower.feedback !== 'align'
        ? L.sent(feedbackKey(tower.feedback))
        : L('Align the moving block with the outline');
  return (
    <div className={styles.screen} style={seatStyle(slot)} data-stage={stage || undefined}>
      <header className={styles.top}>
        <div className={styles.titleRow}>
          <h2>{L('Your tower {n}', { n: slot + 1 })}</h2>
          <p className={styles.time} role="timer" data-low={left <= 5000 || undefined}>
            {clockText(left)}
          </p>
        </div>
        <div className={styles.stats}>
          <strong>{L('Now {n}', { n: tower.height })}</strong>
          <span>{L('Best {n}', { n: tower.best })}</span>
        </div>
      </header>
      <div className={styles.visual}>
        <Tower
          tower={tower}
          now={Math.min(now, view.endsAt)}
          course={view.course}
          active
          name={myName}
        />
        <div className={styles.feedback} data-feedback={tower.feedback}>
          <p role="status" aria-live="polite">
            {feedback}
          </p>
          <p className={styles.streak}>
            {tower.streak >= GROW_STREAK
              ? L('Perfect streak: {n} · Width restores', { n: tower.streak })
              : L('{n}/{m} perfects to restore width', { n: tower.streak, m: GROW_STREAK })}
          </p>
        </div>
      </div>
      {stage ? (
        <div className={styles.roomRoster}>
          <h3 className={styles.rosterTitle}>{L('Room best heights')}</h3>
          <Roster
            players={view.players}
            scores={view.scores}
            slots={view.slots}
            towers={view.towers}
            mine={view.me.id}
          />
        </div>
      ) : null}
      <footer className={styles.actions}>
        <button
          type="button"
          className={styles.drop}
          disabled={disabled}
          data-pad-primary="true"
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            event.preventDefault();
            act();
          }}
          onClick={(event) => {
            if (event.detail === 0) act();
          }}
        >
          {finishedTower ? L('TOWER COMPLETE') : missing ? L('BUILD AGAIN') : L('DROP BLOCK')}
        </button>
        <p className={styles.actionHint}>
          {missing
            ? L('Your best height stays in the race')
            : L('One tap · Best height wins in 45 seconds')}
        </p>
      </footer>
    </div>
  );
}
