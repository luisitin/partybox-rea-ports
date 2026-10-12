import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent as ReactKeyboardEvent, PointerEvent } from 'react';
import { buzz, usePhoneOnly, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { BonkControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Arena } from './Arena';
import { ControlSession, emptyHeld, keyEventControl, shortcutModified } from './controls';
import type { Control } from './controls';
import { finalRoundText } from './roundContext';
import { clockText, playerStyle, secondsLeft, standingsRows } from './standings';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

const CONTROLS: readonly Control[] = ['left', 'right', 'jump', 'heavy'];

export function Controller({
  view,
  send,
}: GameControllerProps<BonkControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const sound = useSound();
  const now = useServerNow(100, view.paused, view.clockHeldAt);
  const player = view.me.role === 'player';
  const active = player && view.phaseId === 'play' && view.alive && !view.departed && !view.paused;
  const key = `${view.phaseId}:${view.round}:${view.paused}:${view.alive}:${view.departed}`;
  const latest = useRef({ key, active, send, sound, grounded: view.grounded });
  latest.current = { key, active, send, sound, grounded: view.grounded };
  const sessionRef = useRef<ControlSession | null>(null);
  if (sessionRef.current === null)
    sessionRef.current = new ControlSession((input) => latest.current.send(input));
  const session = sessionRef.current;
  const [paint, setPaint] = useState({ key, held: emptyHeld(), jumping: false });
  const held = paint.key === key ? paint.held : emptyHeld();
  const jumping = paint.key === key && paint.jumping;
  const actions = useRef({
    press: (_control: Control, _source: string, _down: boolean): void => undefined,
    reset: (): void => undefined,
  });

  const repaint = (): void =>
    setPaint({
      key: latest.current.key,
      held: session.held,
      jumping: session.jumpSources.length > 0,
    });
  actions.current = {
    press: (control, source, down) => {
      // Read the current view even when a listener was installed in an earlier server snapshot.
      session.context(latest.current.key, latest.current.active);
      if (control === 'jump') {
        if (session.pressJump(source, down)) {
          if (latest.current.grounded) {
            buzz(12);
            latest.current.sound('clack', { quiet: true, gain: 0.3 });
          }
        }
      } else {
        const wasHeld = session.held[control].includes(source);
        session.press(control, source, down);
        if (down && !wasHeld && latest.current.active) buzz(8);
      }
      repaint();
    },
    reset: () => {
      session.reset();
      repaint();
    },
  };

  useEffect(() => {
    session.context(key, active);
    setPaint({ key, held: session.held, jumping: session.jumpSources.length > 0 });
  }, [session, key, active]);

  useEffect(() => {
    const keyboard =
      (down: boolean) =>
      (event: KeyboardEvent): void => {
        if (
          event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
        )
          return;
        const control = keyEventControl(event.key, down, event);
        if (!control) return;
        if (down && !latest.current.active) return;
        event.preventDefault();
        if (down && event.repeat) return;
        actions.current.press(control, `key:${event.code || event.key.toLowerCase()}`, down);
      };
    const down = keyboard(true);
    const up = keyboard(false);
    const reset = (): void => actions.current.reset();
    const hidden = (): void => {
      if (document.hidden) reset();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    window.addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
      window.removeEventListener('pagehide', reset);
      document.removeEventListener('visibilitychange', hidden);
      session.reset();
    };
  }, [session]);

  const phase = view.phaseId;
  const finalRound = view.round >= view.rounds;
  const ranked = phase === 'score' || phase === 'done';
  const stage = phoneOnly || view.balls !== undefined || !player || view.departed;
  const seconds = secondsLeft(view.deadline, now);
  const style = playerStyle(Math.max(0, view.slot)) as CSSProperties;
  const rows = standingsRows(view, view.me.id, ranked);
  const leaders = rows.filter((row) => row.rank === 1);
  const winners = rows.filter((row) => view.lastWinners.includes(row.id));
  const myPoints = view.scores[view.me.id] ?? 0;
  const myName = view.players.find((item) => item.id === view.me.id)?.name ?? '';
  let title = L('Round {n} of {m}', { n: view.round, m: view.rounds });
  let hint = player ? L('Bump rivals off. Stay on the platform.') : L('Watching the arena');
  if (view.departed && (phase === 'play' || phase === 'ready')) {
    title = L('You left the match');
    hint = L('Watching now — this seat will not return.');
  } else if (phase === 'play') {
    title = player
      ? view.alive
        ? L('Ball {n} · {name}', { n: view.slot + 1, name: myName })
        : finalRound
          ? L('Out of the final round')
          : L('Out until next round')
      : L('Watching the arena');
    hint = view.paused
      ? L('Paused — release your holds')
      : player && !view.alive
        ? finalRound
          ? L('Keep watching. Final results are next.')
          : L('Keep watching. You return next round.')
        : L('{n} of {m} still in', { n: view.aliveCount, m: view.total });
  } else if (phase === 'score') {
    title =
      view.roundOutcome === 'draw'
        ? L('Round drawn — no points')
        : winners.length === 1
          ? L('{name} wins +1', { name: winners[0]?.name ?? '' })
          : L('{n} survivors share +1', { n: winners.length });
    hint = player
      ? L('+{n} this round · {m} wins total', { n: view.lastPoints[view.me.id] ?? 0, m: myPoints })
      : L('Round {n} over', { n: view.round });
  } else if (phase === 'done') {
    title =
      leaders.length === 1
        ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
        : L('Shared victory!');
    hint =
      player && view.rank !== null
        ? L('Place {rank}{tie} · {n} wins', {
            rank: view.rank,
            tie: view.tied ? L(' · tied') : '',
            n: myPoints,
          })
        : L('Final standings');
  } else if (phase === 'ready') {
    hint = player
      ? L('Find ball {n}. Hold to roll; tap to jump.', { n: view.slot + 1 })
      : L('Last standing wins a point');
  }
  const shrinkSeconds = Math.max(0, Math.ceil((view.began + 15_000 - now) / 1000));
  const hazard = view.hazard
    ? L('Platforms shrinking!')
    : L('Platforms shrink in {n}s', { n: shrinkSeconds });
  const labels: Record<Control, string> = {
    left: L('Left'),
    right: L('Right'),
    jump: L('Jump'),
    heavy: L('Heavy'),
  };
  const glyphs: Record<Control, string> = { left: '←', right: '→', jump: '↑', heavy: '▰' };
  const releasePointer = (control: Control, event: PointerEvent<HTMLButtonElement>): void => {
    actions.current.press(control, `pointer:${event.pointerId}`, false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const nativeKey = (
    control: Control,
    event: ReactKeyboardEvent<HTMLButtonElement>,
    down: boolean,
  ): void => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    if (down && shortcutModified(event)) return;
    event.preventDefault();
    if (down && event.repeat) return;
    actions.current.press(control, `button:${control}:${event.key}`, down);
  };

  return (
    <div
      className={styles.screen}
      style={style}
      data-stage={stage ? 'true' : undefined}
      data-phase={phase}
      data-controls={player && !view.departed && !ranked ? 'true' : undefined}
    >
      <header className={styles.header}>
        <h2 className={styles.title} title={title}>
          {title}
        </h2>
        <p className={styles.hint}>{hint}</p>
        {phase === 'done' ? (
          <p className={styles.hint}>{finalRoundText(winners, view.roundOutcome, L)}</p>
        ) : null}
      </header>
      {phase !== 'done' ? (
        <div className={styles.meta}>
          <span>
            {phase === 'play'
              ? L('Round {n} of {m} · {hazard}', { n: view.round, m: view.rounds, hazard })
              : phase === 'ready'
                ? view.departed
                  ? L('Round {n} of {m} · Get ready', { n: view.round, m: view.rounds })
                  : L('Get ready')
                : view.round >= view.rounds
                  ? L('Final results in')
                  : L('Next round in')}
          </span>
          <b role="timer">{clockText(seconds)}</b>
        </div>
      ) : null}
      {stage && view.balls ? (
        <div className={styles.arena}>
          <Arena
            balls={view.balls}
            platforms={view.platforms}
            width={view.arenaWidth}
            height={view.arenaHeight}
            hazard={view.hazard}
            animate={phase === 'play' && !view.paused}
            me={player ? view.me.id : undefined}
          />
        </div>
      ) : !ranked ? (
        <div className={styles.identity}>
          <span className={styles.myBall}>{view.slot + 1}</span>
          <b>
            {view.departed
              ? L('Watching')
              : !view.alive && phase === 'play'
                ? L('Out')
                : view.heavy && phase === 'play'
                  ? L('Heavy ▰')
                  : L('Your ball')}
          </b>
        </div>
      ) : null}
      {player && !view.departed && !ranked ? (
        <>
          <div className={styles.controls} role="group" aria-label={L('Ball controls')}>
            {CONTROLS.map((control) => (
              <button
                key={control}
                type="button"
                className={styles.control}
                disabled={!active}
                aria-label={
                  control === 'jump'
                    ? L('Tap Jump')
                    : L('Hold {control}', { control: labels[control] })
                }
                aria-pressed={control !== 'jump' ? held[control].length > 0 : undefined}
                data-held={
                  (control === 'jump' ? jumping : held[control].length > 0) ? 'true' : undefined
                }
                onPointerDown={(event) => {
                  if (!latest.current.active) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  actions.current.press(control, `pointer:${event.pointerId}`, true);
                }}
                onPointerUp={(event) => releasePointer(control, event)}
                onPointerCancel={(event) => releasePointer(control, event)}
                onLostPointerCapture={(event) =>
                  actions.current.press(control, `pointer:${event.pointerId}`, false)
                }
                onKeyDown={(event) => nativeKey(control, event, true)}
                onKeyUp={(event) => nativeKey(control, event, false)}
                onBlur={() => actions.current.reset()}
                onClick={(event) => {
                  // Synthetic activation from assistive technology has no pointer or native key event.
                  if (event.detail !== 0) return;
                  if (control === 'jump') {
                    actions.current.press('jump', 'assistive', true);
                    actions.current.press('jump', 'assistive', false);
                  } else
                    actions.current.press(
                      control,
                      'assistive',
                      !session.held[control].includes('assistive'),
                    );
                }}
              >
                <span className={styles.glyph} aria-hidden="true">
                  {glyphs[control]}
                </span>
                <b>{labels[control]}</b>
                <span className={styles.actionHint}>
                  {control === 'jump' ? L('Tap') : L('Hold')}
                </span>
              </button>
            ))}
          </div>
          <p className={styles.footer}>{L('Heavy = stronger bumps, slower moves')}</p>
        </>
      ) : (
        <>
          {ranked ? (
            <div className={styles.columns}>
              <span>{rows.some((row) => row.tied) ? L('Place · = tied') : L('Place')}</span>
              <span>{L('Wins')}</span>
            </div>
          ) : null}
          <ul className={styles.rows} aria-label={ranked ? L('Standings') : L('Players')}>
            {rows.map((row) => (
              <li
                key={row.id}
                style={playerStyle(row.slot) as CSSProperties}
                data-me={row.me ? 'true' : undefined}
                data-out={phase === 'play' && !row.alive ? 'true' : undefined}
              >
                <span className={styles.rowBadge}>{row.slot + 1}</span>
                {ranked ? (
                  <span
                    className={styles.rank}
                    aria-label={L('Place {n}{tie}', {
                      n: row.rank,
                      tie: row.tied ? L(', tied') : '',
                    })}
                  >
                    {row.rank}
                    {row.tied ? '=' : ''}
                  </span>
                ) : null}
                <b className={styles.name} title={row.name}>
                  {row.name}
                </b>
                {phase === 'play' ? (
                  <span className={styles.rowStatus}>
                    {row.departed
                      ? L('Left')
                      : !row.connected
                        ? L('Offline')
                        : !row.alive
                          ? L('Out')
                          : row.heavy
                            ? L('Heavy')
                            : L('In')}
                  </span>
                ) : null}
                {phase === 'score' && row.gained > 0 ? (
                  <span className={styles.gain}>+{row.gained}</span>
                ) : null}
                <b className={styles.points}>
                  {row.total}
                  <span className={styles.srOnly}> {L('wins')}</span>
                </b>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
