import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { buzz, usePhoneOnly, useServerNow, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { PongPartyControllerView } from '../server/index';
import type { Input } from '../server/world';
import { Arena } from './Arena';
import { EdgeGuide } from './EdgeGuide';
import { PhoneStandings } from './PhoneStandings';
import { clockText, slotStyle, standingsRows } from './standings';
import { STRINGS } from './strings';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<PongPartyControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly() || view.phoneStage;
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const controlId = useId();
  const hintId = useId();
  const dragging = useRef(false);
  const previousLives = useRef(view.lives);
  const [position, setPosition] = useState(view.position);
  const playing = view.phaseId === 'play';
  const player = view.me.role === 'player';
  const defending = playing && player && view.alive;
  const live = defending && !view.paused;
  const showStage = phoneOnly || !defending;
  const msLeft = Math.max(0, view.endsAt - now);
  const rows = standingsRows(view, view.me.id, !playing);
  const won = view.winnerIds.includes(view.me.id);
  const ownName = view.players.find((p) => p.id === view.me.id)?.name ?? '';
  const winnerRows = rows.filter((row) => view.winnerIds.includes(row.id));
  const stageTitle = playing
    ? player && !view.alive
      ? L('You are out — keep watching')
      : L('Octo Rally')
    : won
      ? view.tied
        ? L('You share the victory!')
        : L('You won!')
      : winnerRows.length === 1
        ? L('{name} wins!', { name: winnerRows[0]?.name ?? '' })
        : L('A shared victory!');

  // A reconnect starts from the authoritative paddle. During a drag, acknowledgements never pull the thumb backwards.
  useEffect(() => {
    if (!live) dragging.current = false;
    if (!dragging.current) setPosition(view.position);
  }, [view.position, live]);
  useEffect(() => {
    if (player && view.lives < previousLives.current) buzz([40, 60, 40]);
    previousLives.current = view.lives;
  }, [player, view.lives]);
  const move = (value: number): void => {
    if (!live) return;
    setPosition(value);
    send({ type: 'move', position: value });
  };
  const ownStyle: CSSProperties = {
    ...slotStyle(Math.max(0, view.slot)),
    ['--position' as string]: String(position),
  };

  return (
    <div
      className={styles.screen}
      style={ownStyle}
      data-stage={showStage ? 'true' : undefined}
      data-play={playing ? 'true' : undefined}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>
          {showStage ? stageTitle : L('Defend paddle {n}', { n: view.slot + 1 })}
        </h2>
        {playing ? (
          <span className={styles.clock} role="timer">
            {clockText(msLeft)}
          </span>
        ) : null}
      </header>

      {player ? (
        <div className={styles.identity}>
          <span className={styles.slot} aria-label={L('Paddle {n}', { n: view.slot + 1 })}>
            {view.slot + 1}
          </span>
          <div className={styles.personalStats}>
            <span className={styles.nameLine}>
              <span className={styles.name}>{ownName}</span>
              {!playing && view.rank !== null ? (
                <span className={styles.rank}>{L('Place {rank}', { rank: view.rank })}</span>
              ) : null}
            </span>
            <span className={styles.lives}>
              <span aria-live="polite" aria-atomic="true">
                {view.lives === 1 ? L('1 life') : L('{n} lives', { n: view.lives })}
              </span>
              <span aria-hidden="true"> · </span>
              {view.saves === 1 ? L('1 save') : L('{n} saves', { n: view.saves })}
            </span>
          </div>
          <span className={styles.lifeMarks} aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} data-full={i < view.lives ? 'true' : undefined} />
            ))}
          </span>
        </div>
      ) : null}

      {showStage ? (
        <div className={styles.arenaRegion}>
          <div className={styles.arenaWrap}>
            <Arena
              world={view.world}
              checked={view.checked}
              ownId={player ? view.me.id : undefined}
              compact
            />
          </div>
        </div>
      ) : (
        <div className={styles.focus}>
          <p className={styles.find}>{L('Find your number on the TV.')}</p>
          <p className={styles.hint}>
            {L('Keep the ball inside your edge. Each miss costs one life.')}
          </p>
          <EdgeGuide slot={view.slot} position={position} />
          <p className={styles.survivors}>
            {L('{n} of {m} still defending', { n: view.aliveCount, m: view.total })}
          </p>
        </div>
      )}

      {defending ? (
        <div className={styles.controls}>
          <label className={styles.controlLabel} htmlFor={controlId}>
            {L('Slide to move your paddle')}
          </label>
          <input
            id={controlId}
            className={styles.slider}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={position}
            disabled={!live}
            aria-describedby={hintId}
            aria-valuetext={L('{n} percent along your edge', { n: Math.round(position * 100) })}
            onChange={(event) => move(Number(event.currentTarget.value))}
            onPointerDown={(event) => {
              dragging.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
            onLostPointerCapture={() => {
              dragging.current = false;
            }}
            onBlur={() => {
              dragging.current = false;
            }}
          />
          <div className={styles.directionLabels} aria-hidden="true">
            <span>{L('↶ Counter-clockwise')}</span>
            <span>{L('Clockwise ↷')}</span>
          </div>
          <p id={hintId} className={styles.controlHint}>
            {view.paused
              ? L('Paused')
              : phoneOnly
                ? L('Your numbered edge is circled above.')
                : L('Watch your paddle on the TV as you slide.')}
          </p>
        </div>
      ) : (
        <PhoneStandings rows={rows} winnerIds={view.winnerIds} />
      )}
    </div>
  );
}
