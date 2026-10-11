// Every player has the complete slice surface, including remote and phone-only rooms.
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { buzz, usePhoneOnly, useServerNow, useSound, useT } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { Input, SliceControllerView } from '../server/types';
import { Fountain, FRUIT_NAMES, FruitArt } from './Fountain';
import { Standings } from './Standings';
import { STRINGS } from './strings';
import { useSlice } from './useSlice';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<SliceControllerView, Input>): JSX.Element {
  const L = useT(STRINGS);
  const phoneOnly = usePhoneOnly();
  const sound = useSound();
  const now = useServerNow(100, view.paused, view.clockHeldAt);
  const input = useSlice(view, send, now);
  const seen = useRef(view.lastSeq);
  const player = view.me.role === 'player';
  const running = view.phaseId === 'play';
  const stage = phoneOnly || view.stage || !player;
  const enabled = player && running && !view.bombed && !view.paused;
  const seconds =
    running && view.deadline !== null
      ? Math.max(0, Math.ceil((view.deadline - now) / 1000))
      : view.seconds;
  useEffect(() => {
    if (view.lastSeq > seen.current && player) {
      sound(view.bombed ? 'wrong' : view.feedbackPoints > 0 ? 'correct' : 'lock');
      buzz(view.bombed ? 120 : 20);
    }
    seen.current = view.lastSeq;
  }, [view.lastSeq, view.bombed, view.feedbackPoints, player, sound]);

  if (!running) {
    const top = Math.max(0, ...view.rows.map((row) => row.score));
    const leaders = view.rows.filter((row) => row.score === top);
    const title =
      view.phaseId === 'score'
        ? L('Time’s up!')
        : leaders.length === 1
          ? L('{name} wins!', { name: leaders[0]!.name })
          : L('A tie at the top!');
    return (
      <div className={styles.summary}>
        <h2>{title}</h2>
        {player ? <p className={styles.total}>{L('{n} points', { n: view.score })}</p> : null}
        {player ? <p>{L('Your best combo: {n} fruit', { n: view.bestCombo })}</p> : null}
        {player ? (
          <p>
            {L('Place {n}', { n: 1 + view.rows.filter((row) => row.score > view.score).length })}
            {view.rows.some((row) => row.id !== view.me.id && row.score === view.score)
              ? L(' · tied')
              : ''}
          </p>
        ) : null}
        <Standings rows={view.rows} me={player ? view.me.id : undefined} compact final />
        <p>{L('Highest points wins. Everyone stays in the game.')}</p>
      </div>
    );
  }

  const targets = input.drawing?.targets ?? view.targets;
  const fruit = targets.filter((target) => !target.bomb);
  const feedback = view.bombed
    ? L('Bomb! Back on the next wave')
    : input.hint
      ? L(input.hint)
      : view.feedback
        ? `${L(view.feedback)}${view.feedbackPoints > 0 ? ` +${view.feedbackPoints}` : ''}`
        : player
          ? L('Quick swipes · 3+ fruit = double points')
          : L('Watching the shared fountain');
  return (
    <div
      className={styles.screen}
      data-stage={stage ? 'true' : undefined}
      data-player={player ? 'true' : undefined}
    >
      <header className={styles.header}>
        <div>
          <h2>{L('Fruit Slice')}</h2>
          {player ? (
            <strong className={styles.score}>
              {view.score}
              <span>{L(' points')}</span>
            </strong>
          ) : (
            <p>{L('Spectating')}</p>
          )}
        </div>
        <div
          className={styles.clock}
          role="timer"
          aria-label={L('{n} seconds left', { n: seconds })}
          data-low={seconds <= 5 ? 'true' : undefined}
        >
          <strong>{seconds}</strong>
          <span>{L('seconds')}</span>
        </div>
        {player ? (
          <div className={styles.streak}>
            <strong>↗ {view.streak}</strong>
            <span>{L('streak')}</span>
          </div>
        ) : null}
      </header>
      <div className={styles.arenaSlot}>
        <div
          className={styles.field}
          {...(enabled ? input.handlers : {})}
          data-locked={view.bombed ? 'true' : undefined}
        >
          <Fountain
            targets={targets}
            trail={input.drawing?.points}
            label={L('Swipe through fruit. Avoid the X bombs.')}
            numbered={player}
          />
          {view.bombed || fruit.length === 0 ? (
            <p className={styles.overlay}>
              {view.bombed ? L('Next wave, fresh start') : L('Clean sweep!')}
            </p>
          ) : null}
        </div>
      </div>
      <p
        className={styles.feedback}
        role="status"
        aria-live="polite"
        data-bomb={view.bombed ? 'true' : undefined}
      >
        {feedback}
      </p>
      {stage ? <Standings rows={view.rows} me={player ? view.me.id : undefined} compact /> : null}
      {player ? (
        <footer className={styles.controls}>
          <div
            className={styles.buttons}
            role="group"
            aria-label={L('Tap controls. Nearby bombs still count.')}
          >
            {view.targets
              .filter((target) => !target.bomb)
              .map((target, index) => (
                <button
                  key={target.id}
                  type="button"
                  disabled={!enabled}
                  onClick={() => input.tap(target)}
                  aria-label={L('Slice {fruit} {n}', {
                    fruit: L(FRUIT_NAMES[target.kind] ?? 'Fruit'),
                    n: index + 1,
                  })}
                >
                  <svg viewBox="-9 -11 18 20" aria-hidden="true">
                    <FruitArt kind={target.kind} bomb={false} />
                  </svg>
                  <span>{index + 1}</span>
                </button>
              ))}
          </div>
          <p>{L('Or tap a fruit number. Nearby X bombs still count.')}</p>
        </footer>
      ) : null}
    </div>
  );
}
