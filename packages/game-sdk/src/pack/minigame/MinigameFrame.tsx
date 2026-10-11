// ADR-087: the Superstars minigame sequence around any game (bible S15–S18): title card →
// instructions with the live demo → 3·2·1·Go! → the game with a timer chip → Finish! → winners.
// The frame never renders the game: the host hands `renderGame` the game's own view and mounts the
// game's TV or phone component there, so the minigame is the game's real screens, unchanged.
import { useEffect } from 'react';
import type { JSX, ReactNode } from 'react';
import { COUNT_MS } from '../../minigame/run';
import type { MinigameControllerView, MinigameView } from '../../minigame/types';
import { Avatar } from '../../ui/Avatar';
import { useSecondsLeft, useServerBeats } from '../../ui/clock';
import { buzz } from '../../ui/haptics';
import { useT } from '../../ui/lang';
import { HowTo } from './HowTo';
import styles from './MinigameFrame.module.css';
import { Result } from './Result';
import { GameArt } from './GameArt';
import { Sheen } from './Sheen';
import { STRINGS } from './strings';

export interface MinigameFrameProps {
  view: MinigameView | MinigameControllerView;
  role: 'tv' | 'phone';
  /** The wrapped game's screen for `inner` (`kind: 'play'`) or the instruction demo (`'demo'`). */
  renderGame: (inner: unknown, kind: 'play' | 'demo') => ReactNode;
  /** Phone: the player tapped Start!; send `{ mg: 'ready' }`. */
  onReady?: () => void;
  paused?: boolean;
}

const BEATS = [0, 800, 1600, 2400] as const;
// The buzz patterns are constants so a re-render never repeats a cue (T-0620).
const TICK = 12;
const GO = [20, 30, 40];
const DONE = [30, 40, 30];

function Card({ view, role }: { view: MinigameView; role: 'tv' | 'phone' }): JSX.Element {
  const L = useT(STRINGS);
  const byId = new Map(view.players.map((p) => [p.id, p]));
  return (
    <section className={styles.card} aria-live="polite">
      {role === 'tv' ? <Sheen /> : null}
      <span className={styles.icon} aria-hidden>
        <GameArt gameId={view.gameId} name={view.name} size="1em" />
      </span>
      <h2 className={styles.cardTitle}>{view.name}</h2>
      {view.teams.length ? (
        <ul className={styles.teams}>
          {view.teams.map((t) => (
            <li key={t.id} className={styles.team} style={{ '--team': t.color } as never}>
              <span aria-hidden>{t.mark}</span> {L('Team {name}', { name: L(t.name) })}
              <span className={styles.members}>
                {t.members.map((id) => (
                  <Avatar key={id} avatarId={byId.get(id)?.avatarId ?? ''} size={56} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** A phone's buzz when this mounts (render it with a key to buzz on every change): the count and the finish felt in the hand (T-0620). */
function Cue({ pattern }: { pattern: number | number[] }): null {
  useEffect(() => {
    buzz(pattern);
  }, [pattern]);
  return null;
}

function Count({ view, role }: { view: MinigameView; role: 'tv' | 'phone' }): JSX.Element {
  const L = useT(STRINGS);
  const startedAt = (view.stageEnds ?? 0) - COUNT_MS;
  const beat = useServerBeats(startedAt, BEATS);
  const text = beat >= 3 ? L('Go!') : String(3 - beat);
  return (
    <section className={styles.count} aria-live="assertive">
      {role === 'phone' ? <Cue key={`cue-${text}`} pattern={beat >= 3 ? GO : TICK} /> : null}
      <span key={text} className={styles.digit}>
        {text}
      </span>
    </section>
  );
}

/** Overtime on the TV (T-0946): the round's clock is out and the game still runs, waiting on a player.
 *  The stage's edge breathes and a red band sweeps across it, so the held frame is never still. */
export function Overtime({
  end,
  paused,
}: {
  end: number | null;
  paused: boolean;
}): JSX.Element | null {
  const s = useSecondsLeft(end, paused);
  return s === 0 ? (
    <div className={styles.overtime} data-overtime aria-hidden>
      <span className={styles.overtimeGlow} />
      <span className={styles.overtimeSweep} />
    </div>
  ) : null;
}

/** The timer chip, "0:45": the nominal time left (overtime sits at 0:00 until the game ends). */
function Chip({ end, paused }: { end: number | null; paused: boolean }): JSX.Element | null {
  const s = useSecondsLeft(end, paused);
  if (s === null) return null;
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <span className={`${styles.chip} ${s <= 5 ? styles.urgent : ''}`} role="timer">
      {text}
    </span>
  );
}

export function MinigameFrame(props: MinigameFrameProps): JSX.Element {
  const { view, role, renderGame, onReady, paused = false } = props;
  const L = useT(STRINGS);
  const stage = view.stage;
  if (stage === 'card') return <Card view={view} role={role} />;
  if (stage === 'howto')
    return <HowTo view={view} role={role} demo={renderGame(view.demo, 'demo')} onReady={onReady} />;
  if (stage === 'countdown') return <Count view={view} role={role} />;
  if (stage === 'result' || stage === 'done') return <Result view={view} role={role} />;
  return (
    <div className={styles.play}>
      <div className={`${styles.bar} ${role === 'phone' ? styles.gutter : ''}`}>
        <span className={styles.gameName}>
          <GameArt gameId={view.gameId} name={view.name} size="1.1em" /> {view.name}
        </span>
        {stage === 'play' ? <Chip end={view.stageEnds} paused={paused} /> : null}
      </div>
      {role === 'phone' && stage === 'play' && view.controls[0] ? (
        <p className={styles.hint}>{view.controls[0]}</p>
      ) : null}
      <div className={styles.stage}>{renderGame(view.inner, 'play')}</div>
      {role === 'tv' && stage === 'play' ? <Overtime end={view.stageEnds} paused={paused} /> : null}
      {stage === 'finish' ? (
        <div className={styles.finish} role="status">
          {role === 'phone' ? <Cue pattern={DONE} /> : null}
          {L('Finish!')}
        </div>
      ) : null}
    </div>
  );
}
