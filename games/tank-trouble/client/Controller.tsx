// A tank's held pad, or the complete public stage when this phone cannot see the TV. Only the server judges shots and knockouts.
import { useEffect, useRef } from 'react';
import type { CSSProperties, JSX, PointerEvent } from 'react';
import {
  WaitingScreen,
  buzz,
  usePhoneOnly,
  useServerNow,
  useSound,
  useT,
} from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { TankTroubleControllerView } from '../server/index';
import type { Input } from '../server/world';
import { Arena } from './Arena';
import { Standings } from './Standings';
import { RoundResult } from './RoundResult';
import { useControls } from './controls';
import type { ControlAction } from './controls';
import { STRINGS } from './strings';
import { clockText, playerColor, weaponName } from './timing';
import styles from './Controller.module.css';

const ACTIONS: readonly { action: ControlAction; mark: string; label: string }[] = [
  { action: 'forward', mark: '▲', label: 'Forward' },
  { action: 'left', mark: '◀', label: 'Left' },
  { action: 'right', mark: '▶', label: 'Right' },
  { action: 'reverse', mark: '▼', label: 'Reverse' },
  { action: 'fire', mark: '◎', label: 'Fire' },
];

export function Controller({
  view,
  send,
}: GameControllerProps<TankTroubleControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const sound = useSound();
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const phase = view.phaseId;
  const player = view.me.role === 'player';
  const participating = player && view.participating;
  const connected = view.players.find((seat) => seat.id === view.me.id)?.connected !== false;
  const active = phase === 'play' && participating && view.alive && connected && !view.paused;
  const { held, press, steerStart, steerMove, steerEnd } = useControls(
    active,
    `${phase}:${view.round}`,
    send,
  );
  const stage = phoneOnly || !participating;
  const playing = phase === 'play' && participating && view.alive;
  const mine = view.scores[view.me.id] ?? 0;
  const ownTank = view.arena.tanks.find((tank) => tank.id === view.me.id);
  const waitingForShellSlots =
    view.weapon === 'scatter' &&
    view.ammo > 0 &&
    view.arena.bullets.filter((bullet) => bullet.owner === view.me.id).length > 2;
  const tint: CSSProperties = { ['--tank-color' as string]: playerColor(Math.max(0, view.slot)) };
  const left = view.deadline === null ? 0 : Math.max(0, view.deadline - now);
  const rounds = L('Round {n} of {m}', { n: view.round, m: view.rounds });
  const aliveLine = L('{n} of {m} tanks still in', { n: view.aliveCount, m: view.total });

  // Sounds confirm changes in this hand, never a client-side firing decision.
  const previous = useRef({
    round: view.round,
    ammo: view.ammo,
    weapon: view.weapon,
    alive: view.alive,
  });
  useEffect(() => {
    const old = previous.current;
    if (old.round === view.round && phase === 'play' && player) {
      if (old.weapon !== view.weapon && view.weapon !== 'shell') {
        sound('clack', { quiet: true, gain: 0.6 });
        buzz(30);
      } else if (view.ammo < old.ammo && view.alive) sound('submit', { quiet: true, gain: 0.35 });
      if (old.alive && !view.alive) buzz(90);
    }
    previous.current = {
      round: view.round,
      ammo: view.ammo,
      weapon: view.weapon,
      alive: view.alive,
    };
  }, [view.round, view.ammo, view.weapon, view.alive, phase, player, sound]);

  const steering = (event: PointerEvent<HTMLDivElement>): [-1 | 0 | 1, -1 | 0 | 1] => {
    const box = event.currentTarget.getBoundingClientRect();
    const fire = event.currentTarget.querySelector('[data-pad-primary]')!.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(event.currentTarget).columnGap) || 0;
    const x = (2 * (event.clientX - box.left)) / Math.max(1, fire.left - box.left - gap / 2) - 1;
    const y = (2 * (event.clientY - box.top)) / Math.max(1, box.height) - 1;
    return [y < -1 / 3 ? 1 : y > 1 / 3 ? -1 : 0, x < -1 / 3 ? -1 : x > 1 / 3 ? 1 : 0];
  };
  const controls = (
    <div
      className={styles.controls}
      role="group"
      aria-label={L('Tank controls')}
      data-steering-pad
      onPointerDown={(event) => {
        if (
          !active ||
          event.button !== 0 ||
          (event.target instanceof Element && event.target.closest('[data-pad-primary]'))
        )
          return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const [drive, turn] = steering(event);
        steerStart(`steer:${event.pointerId}`, drive, turn);
      }}
      onPointerMove={(event) => {
        const [drive, turn] = steering(event);
        steerMove(`steer:${event.pointerId}`, drive, turn);
      }}
      onPointerUp={(event) => steerEnd(`steer:${event.pointerId}`)}
      onPointerCancel={(event) => steerEnd(`steer:${event.pointerId}`)}
      onLostPointerCapture={(event) => steerEnd(`steer:${event.pointerId}`)}
    >
      {(['↖', '↗', '↙', '↘'] as const).map((mark, index) => (
        <span key={mark} className={styles.diagonal} data-corner={index} aria-hidden="true">
          {mark}
        </span>
      ))}
      {ACTIONS.map(({ action, mark, label }) => (
        <button
          key={action}
          type="button"
          className={`${styles.pad} ${styles[action]}`}
          disabled={!active}
          aria-label={
            action === 'left'
              ? L('Turn left')
              : action === 'right'
                ? L('Turn right')
                : action === 'forward'
                  ? L('Drive forward')
                  : action === 'reverse'
                    ? L('Drive backward')
                    : L('Hold to fire')
          }
          aria-pressed={held[action]}
          data-held={held[action] || undefined}
          data-pad-primary={action === 'fire' || undefined}
          onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
            if (action !== 'fire' || event.button !== 0 || !active) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            press(action, `pointer:${event.pointerId}`, true);
          }}
          onPointerUp={(event) => press(action, `pointer:${event.pointerId}`, false)}
          onPointerCancel={(event) => press(action, `pointer:${event.pointerId}`, false)}
          onLostPointerCapture={(event) => press(action, `pointer:${event.pointerId}`, false)}
          onKeyDown={(event) => {
            if (event.key !== ' ' && event.key !== 'Enter') return;
            event.preventDefault();
            event.stopPropagation();
            press(action, `button:${action}:${event.key}`, true);
          }}
          onKeyUp={(event) => {
            if (event.key !== ' ' && event.key !== 'Enter') return;
            event.preventDefault();
            event.stopPropagation();
            press(action, `button:${action}:${event.key}`, false);
          }}
          onBlur={() => {
            press(action, `button:${action}: `, false);
            press(action, `button:${action}:Enter`, false);
          }}
        >
          <span className={styles.arrow} aria-hidden="true">
            {mark}
          </span>
          <span>{L(label)}</span>
        </button>
      ))}
    </div>
  );

  if (playing) {
    const specialLeft = ownTank
      ? Math.max(0, Math.ceil((view.began + ownTank.weaponUntil - now) / 1000))
      : 0;
    const ammunition =
      view.weapon === 'shell'
        ? L('{n}/5 shell slots', { n: view.ammo })
        : view.weapon === 'scatter'
          ? L(view.ammo === 1 ? '{n} volley · {s}s' : '{n} volleys · {s}s', {
              n: view.ammo,
              s: specialLeft,
            })
          : L('{n} shots · {s}s', { n: view.ammo, s: specialLeft });
    return (
      <div className={styles.play} data-stage={stage || undefined} style={tint}>
        <header className={styles.header}>
          <h2>{L('You are tank {n}', { n: view.slot + 1 })}</h2>
          <div className={styles.meta}>
            <span>{rounds}</span>
            <span role="timer">{clockText(left)}</span>
          </div>
        </header>
        {stage ? (
          <div className={styles.liveArena}>
            <Arena arena={view.arena} players={view.players} me={view.me.id} />
          </div>
        ) : null}
        <div className={styles.weapon} role="status">
          <b>{weaponName(view.weapon, L)}</b>
          <span>{ammunition}</span>
        </div>
        <p className={styles.status} aria-live="polite">
          {view.paused
            ? L('Paused')
            : !connected
              ? L('Reconnecting — controls released')
              : waitingForShellSlots
                ? L('Waiting for shell slots')
                : aliveLine}
        </p>
        {stage ? <Standings view={view} me={view.me.id} compact /> : null}
        {controls}
        <p className={styles.help}>{L('Drag the pad to steer · hold Fire. Shots can hit you.')}</p>
      </div>
    );
  }

  if (phase === 'ready' && participating && !stage) {
    return (
      <div className={styles.ready} style={tint}>
        <h2>{L('Round {n}', { n: view.round })}</h2>
        <span className={styles.identity}>{view.slot + 1}</span>
        <p className={styles.mainLine}>{L('Your tank {n}', { n: view.slot + 1 })}</p>
        <p>{L('Ready')}</p>
        <span className={styles.countdown} role="timer">
          {Math.max(1, Math.ceil(left / 1000))}
        </span>
      </div>
    );
  }

  if (phase === 'score')
    return (
      <RoundResult
        view={view}
        seconds={Math.ceil(left / 1000)}
        me={player ? view.me.id : undefined}
      />
    );

  if (phase === 'play' && participating && !stage) {
    return (
      <WaitingScreen
        title={L('Your tank is out')}
        hint={L('Watch the ricochets — {n} tanks remain', { n: view.aliveCount })}
        mood="watch"
      />
    );
  }

  let title = L('Round {n}', { n: view.round });
  let line = participating ? L('Tank {n}', { n: view.slot + 1 }) : L('Spectating');
  if (phase === 'play') {
    title = participating ? L('Your tank is out') : L('Spectating');
    line = aliveLine;
  } else if (phase === 'done') {
    title = L('Final standings');
    line =
      player && view.rank !== null
        ? view.rank === 1
          ? view.tied
            ? L('You tied for first')
            : L('You won the match!')
          : L('Place {n} · {m} wins', { n: view.rank, m: mine })
        : L('Top score: {n} wins', { n: Math.max(0, ...Object.values(view.scores)) });
  }
  return (
    <div className={styles.stage} data-phase={phase} style={tint}>
      <header className={styles.header}>
        <h2>{title}</h2>
        <p>{line}</p>
      </header>
      {stage ? (
        <div className={styles.stageArena}>
          <Arena arena={view.arena} players={view.players} me={player ? view.me.id : undefined} />
        </div>
      ) : null}
      {phase === 'ready' ? (
        <p className={styles.status}>
          {L('Get ready')} <span role="timer">{Math.max(1, Math.ceil(left / 1000))}</span>
        </p>
      ) : null}
      {phase !== 'ready' ? (
        <Standings view={view} me={player ? view.me.id : undefined} compact={phase === 'play'} />
      ) : null}
    </div>
  );
}
