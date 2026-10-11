// Controller (phone) view for Curve Fever: while your worm runs, the screen is two big halves. Hold the left half to turn left and the
// right half to turn right (both held cancel; a gamepad's bumpers or the arrow keys send too). The server judges every crash by its
// own time; the phone only says which way you are steering. Between rounds it shows your colour, then the points.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, PointerEvent } from 'react';
import { WaitingScreen, buzz, usePhoneOnly, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { CurveFeverControllerView } from '../server/index';
import type { Input } from '../server/world';
import { Arena } from './Arena';
import styles from './Controller.module.css';
import { standingsRows } from './standings';
import { STRINGS } from './strings';
import { countdown, dirOf, hueOf } from './timing';

export function Controller({
  view,
  send,
}: GameControllerProps<CurveFeverControllerView, Input>): JSX.Element {
  const phoneOnly = usePhoneOnly();
  const L = useT(STRINGS);
  const now = useServerNow(250);
  const held = useRef({ left: false, right: false });
  const sent = useRef(0);
  // Which phase and round the lit buttons belong to: a new one starts with nothing held, with no state set in an effect.
  const roundKey = `${view.phaseId}:${view.round}`;
  const [litState, setLit] = useState({ key: '', left: false, right: false });
  const lit = litState.key === roundKey ? litState : { left: false, right: false };
  const steering = view.phaseId === 'play' && view.me.role === 'player' && view.alive;

  /** Say the direction the held buttons mean now, if it changed. */
  const sync = (): void => {
    const dir = dirOf(held.current.left, held.current.right);
    setLit({ key: roundKey, ...held.current });
    if (dir === sent.current) return;
    sent.current = dir;
    send({ type: 'steer', dir });
  };
  const press = (side: 'left' | 'right', down: boolean): void => {
    if (held.current[side] === down) return;
    held.current = { ...held.current, [side]: down };
    if (down) buzz(8);
    sync();
  };
  // A new round (or being out) starts with nothing held; the server starts every worm straight.
  useEffect(() => {
    held.current = { left: false, right: false };
    sent.current = 0;
  }, [view.phaseId, view.round]);
  useEffect(() => {
    if (!steering) return;
    const key =
      (down: boolean) =>
      (e: KeyboardEvent): void => {
        if (e.key === 'ArrowLeft' || e.key === 'a') press('left', down);
        else if (e.key === 'ArrowRight' || e.key === 'd') press('right', down);
      };
    const kd = key(true);
    const ku = key(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steering]);

  const hue: CSSProperties = { ['--hue' as string]: String(hueOf(Math.max(0, view.slot))) };
  const mine = view.scores[view.me.id] ?? 0;

  if (!phoneOnly && view.phaseId === 'ready' && view.me.role === 'player') {
    const secs = view.deadline === null ? 0 : countdown(view.deadline - now);
    return (
      <div className={styles.ready} style={hue}>
        <p className={styles.kicker}>{L('Round {n} of {m}', { n: view.round, m: view.rounds })}</p>
        <i className={styles.swatch} aria-hidden="true" />
        <p className={styles.big}>{L('You are this colour')}</p>
        <p className={styles.hint}>{L('Find your worm on the TV. Hold a side to turn.')}</p>
        <p className={styles.count} aria-live="polite">
          {secs}
        </p>
      </div>
    );
  }
  const pads = (
    <div className={styles.pads} role="group" aria-label={L('Steering')}>
      {(['left', 'right'] as const).map((side) => (
        <div
          key={side}
          className={styles.pad}
          data-lit={lit[side] ? 'true' : undefined}
          data-pad-primary={side === 'right' ? true : undefined}
          role="button"
          tabIndex={0}
          aria-label={side === 'left' ? L('Turn left') : L('Turn right')}
          onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            press(side, true);
          }}
          onPointerUp={() => press(side, false)}
          onPointerCancel={() => press(side, false)}
          onLostPointerCapture={() => press(side, false)}
        >
          <span className={styles.arrow} aria-hidden="true">
            {side === 'left' ? '◀' : '▶'}
          </span>
        </div>
      ))}
    </div>
  );
  const crawling = L('{n} of {m} still crawling', { n: view.aliveCount, m: view.total });

  // Phone only: there is no TV, so the phone is the stage. The arena (when this phone was sent it) sits above the buttons or the
  // standings, and no screen points at a TV.
  if (phoneOnly) {
    const names: Record<string, string> = {};
    for (const p of view.players) names[p.id] = p.name;
    const phase = view.phaseId;
    const secs = view.deadline === null ? 0 : countdown(view.deadline - now);
    const arena = view.worms ? (
      <div className={styles.arena}>
        <Arena
          worms={view.worms}
          began={view.began}
          frozen={phase !== 'play'}
          checked={view.checked}
          names={names}
          showStart={phase === 'ready'}
        />
        {phase === 'ready' ? (
          <span className={styles.arenaCount} aria-live="polite">
            {secs}
          </span>
        ) : null}
      </div>
    ) : null;
    if (steering)
      return (
        <div className={styles.screen} style={hue} data-arena="true">
          <p className={styles.kicker} aria-live="polite">
            {crawling}
          </p>
          {arena}
          {pads}
        </div>
      );
    const rows = standingsRows(view, view.me.id, phase === 'score' || phase === 'done');
    const top = Math.max(0, ...rows.map((r) => r.total));
    const leaders = rows.filter((r) => r.total === top);
    const player = view.me.role === 'player';
    let headline = '';
    let sub = '';
    if (phase === 'ready') {
      headline = L('Round {n} of {m}', { n: view.round, m: view.rounds });
      sub = player ? L('Find your worm by its arrow. Hold a side to turn.') : '';
    } else if (phase === 'play') {
      headline = player ? L('You crashed') : crawling;
      sub = player ? crawling : '';
    } else if (phase === 'score') {
      headline = L('Round {n} over', { n: view.round });
      sub = player
        ? `${L('+{n} this round', { n: view.lastPoints[view.me.id] ?? 0 })} · ${L('{n} points so far', { n: mine })}`
        : '';
    } else if (phase === 'done') {
      headline =
        leaders.length === 1
          ? L('{name} wins!', { name: leaders[0]?.name ?? '' })
          : L('A tie at the top!');
      if (player && view.rank !== null)
        sub = `${view.rank === 1 && !view.tied ? L('You won the match!') : L('Place {rank}', { rank: view.rank })} · ${L('{n} points', { n: mine })}`;
    }
    return (
      <div className={styles.stage} style={hue} data-phase={phase}>
        <h2 className={styles.headline}>{headline}</h2>
        {sub ? <p className={styles.hint}>{sub}</p> : null}
        {arena}
        <ul className={styles.rows} aria-label={L('Players')}>
          {rows.map((r) => (
            <li
              key={r.id}
              style={{ ['--hue' as string]: String(hueOf(r.slot)) }}
              data-me={r.me ? 'true' : undefined}
              data-out={phase === 'play' && r.out ? 'true' : undefined}
            >
              <i className={styles.dot} aria-hidden="true" />
              <b className={styles.name}>{r.name}</b>
              {phase === 'score' && r.gained > 0 ? (
                <span className={styles.gain}>{`+${r.gained}`}</span>
              ) : null}
              <span className={styles.points}>{r.total}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (steering) {
    return (
      <div className={styles.screen} style={hue}>
        <p className={styles.kicker} aria-live="polite">
          {crawling}
        </p>
        {pads}
      </div>
    );
  }
  // Out for the round, between rounds, or the match is over.
  const won = view.rank === 1 && !view.tied;
  let title = L('Look at the TV');
  let hint: string | undefined;
  if (view.phaseId === 'play') {
    title = L('You crashed');
    hint = L('{n} still crawling', { n: view.aliveCount });
  } else if (view.phaseId === 'score') {
    const gained = view.lastPoints[view.me.id] ?? 0;
    title = L('+{n} this round', { n: gained });
    hint = L('{n} points so far', { n: mine });
  } else if (view.phaseId === 'done' && view.rank !== null) {
    title = won
      ? L('You won the match!')
      : view.tied
        ? L('A tie at the top!')
        : L('Place {rank}', { rank: view.rank });
    hint = L('{n} points', { n: mine });
  }
  return <WaitingScreen title={title} hint={hint} mood={won ? 'done' : 'watch'} />;
}
