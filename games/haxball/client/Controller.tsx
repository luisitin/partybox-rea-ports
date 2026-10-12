import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { buzz, usePhoneOnly, useServerNow, useSound } from '@partybox/game-sdk/ui';
import type { GameControllerProps } from '@partybox/game-sdk/ui';
import type { HaxballControllerView } from '../server/index';
import type { Input } from '../server/types';
import { Controls } from './Controls';
import { heldVector } from './input-state';
import { MatchStage, ScoreLine } from './MatchStage';
import { attackRight, jersey, shortName, teamName } from './match';
import { useGoalCue } from './useGoalCue';
import { useHeldControls } from './useHeldControls';
import styles from './Controller.module.css';

export function Controller({
  view,
  send,
}: GameControllerProps<HaxballControllerView, Input>): JSX.Element {
  const phoneOnly = usePhoneOnly();
  useGoalCue(view, phoneOnly);
  const now = useServerNow(250, view.paused, view.clockHeldAt);
  const play = useSound();
  const controls = useHeldControls(view, send);
  // A refresh starts with the retained fire stamp observed, so it cannot replay an old kick.
  const observedKick = useRef({ id: view.me.id, at: view.lastKickAt });
  useEffect(() => {
    if (observedKick.current.id !== view.me.id) {
      observedKick.current = { id: view.me.id, at: view.lastKickAt };
      return;
    }
    if (view.lastKickAt === observedKick.current.at) return;
    observedKick.current = { id: view.me.id, at: view.lastKickAt };
    if (view.lastKickAt !== null && view.me.role === 'player' && !view.departed) {
      play('thud');
      buzz(15);
    }
  }, [view.lastKickAt, view.me.id, view.me.role, view.departed, play]);

  const player = view.me.role === 'player' && view.team !== null && view.number !== null;
  const identity = player ? jersey(view.team!, view.number!) : 'Watch';
  const name = view.discs.find((d) => d.id === view.me.id)?.name ?? '';
  const held = heldVector(controls.sources);
  const title = !player
    ? 'Watching Haxball'
    : view.departed
      ? `${identity} · you left the match`
      : `${teamName(view.team!)} · ${identity} · you`;
  let kickStatus = 'Hold Kick. It fires when you reach the ball.';
  if (view.kickHeld && !view.kickArmed) kickStatus = 'Kick connected · release Kick to rearm';
  else if (view.kickArmed)
    kickStatus =
      view.kickReadyAt > now ? 'Kick armed · recovering' : 'Kick armed · get close to the ball';
  else if (held.kick) kickStatus = 'Kick held · get close to the ball';

  return (
    <section
      className={styles.screen}
      data-surface="controller"
      data-phase={view.phaseId}
      data-phone-only={phoneOnly || undefined}
    >
      <header className={styles.identity} data-team={view.team ?? undefined}>
        <h2>{title}</h2>
        {name ? <p title={name}>{shortName(name, 28)}</p> : null}
      </header>
      {controls.enabled ? (
        <>
          {phoneOnly ? (
            <div className={styles.phonePitch}>
              <MatchStage view={view} now={now} mine={view.me.id} compact />
            </div>
          ) : (
            <div className={styles.score}>
              <ScoreLine view={view} now={now} />
              <p className={styles.attack}>
                Attack the {attackRight(view, view.team!) ? 'right →' : '← left'} goal
              </p>
            </div>
          )}
          <p className={styles.feedback} role="status" aria-live="polite">
            {kickStatus}
          </p>
          <Controls sources={controls.sources} update={controls.update} identity={identity} />
          <p className={styles.hint}>
            Hold arrows to move, including diagonals. Release Kick after it fires.
            <br />
            <span>Keyboard: arrows or WASD · Space or X kicks</span>
          </p>
        </>
      ) : (
        <div className={styles.watching}>
          <MatchStage view={view} now={now} mine={player ? view.me.id : undefined} />
          <p className={styles.hint}>
            {!player
              ? 'You are watching the match.'
              : view.departed
                ? 'Your team keeps its number. You are watching.'
                : view.paused
                  ? 'Controls are released while the match is paused.'
                  : view.phaseId === 'done'
                    ? 'The final team scores are above.'
                    : 'Watch the pitch. Controls return when play begins.'}
          </p>
        </div>
      )}
    </section>
  );
}
