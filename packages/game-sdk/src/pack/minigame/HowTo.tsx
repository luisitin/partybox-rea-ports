// S15/S16: the instruction screen, laid out like Jamboree's: the name top-left, the live demo window
// ("Practice Time!") on the left, the Controls list on the right, Toad's two lines of how-to bottom-left, and
// the yellow Start! bar with a Ready! under each player bottom-right. The phone gets the same things in one
// column with one big Start! button. Everything the demo shows is the game's own view; the frame only places it.
import type { JSX, ReactNode } from 'react';
import type { MinigameControllerView, MinigameView } from '../../minigame/types';
import { PrimaryButton } from '../../controller/PrimaryButton';
import { Avatar } from '../../ui/Avatar';
import { useT } from '../../ui/lang';
import styles from './HowTo.module.css';
import { STRINGS } from './strings';
import { TapArt } from './GameBadge';
import { GameArt } from './GameArt';
import { Toad } from './Toad';
import { Sheen } from './Sheen';

export interface HowToProps {
  view: MinigameView | MinigameControllerView;
  role: 'tv' | 'phone';
  demo: ReactNode;
  onReady?: () => void;
}

/** "Tap · Throw at that row": the input as a key cap, then what it does. */
function Controls({ lines, compact }: { lines: string[]; compact?: boolean }): JSX.Element {
  const L = useT(STRINGS);
  return (
    <section className={compact ? styles.controlsCompact : styles.controls}>
      {compact ? null : <h3 className={styles.controlsHead}>{L('Controls')}</h3>}
      <ul className={styles.controlList}>
        {lines.map((line) => {
          const at = line.indexOf(' · ');
          const key = at > 0 ? line.slice(0, at) : null;
          return (
            <li key={line}>
              {key ? <kbd className={styles.key}>{key}</kbd> : null}
              <span>{key ? line.slice(at + 3) : line}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** No live demo: a picture of the phone with the controls on its screen. */
function PhonePic({ view }: { view: MinigameView }): JSX.Element {
  const keys = view.controls
    .map((c) => (c.includes(' · ') ? (c.split(' · ')[0] ?? '') : ''))
    .filter(Boolean);
  return (
    <div className={styles.phonePic} aria-hidden>
      <div className={styles.phoneBody}>
        <span className={styles.phoneIcon}>
          <GameArt gameId={view.gameId} name={view.name} size="96px" />
        </span>
        {keys.length > 0 ? (
          keys.map((k) => (
            <span key={k} className={styles.phoneKey}>
              {k}
            </span>
          ))
        ) : (
          <span className={styles.phoneIcon}>
            <TapArt size="96px" />
          </span>
        )}
      </div>
    </div>
  );
}

/** Toad and his speech bubble: the game's two how-to lines. */
function Says({ lines, toad }: { lines: string[]; toad: number }): JSX.Element {
  return (
    <div className={styles.says}>
      <Toad size={toad} />
      <div className={styles.bubble}>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export function HowTo({ view, role, demo, onReady }: HowToProps): JSX.Element {
  const L = useT(STRINGS);
  const everyoneReady = view.players.every((p) => p.bot || !p.connected || p.ready);
  if (role === 'phone') {
    const me = 'me' in view ? view.me : null;
    return (
      <section className={styles.phone}>
        <h2 className={styles.phoneTitle}>
          <GameArt gameId={view.gameId} name={view.name} size="1.1em" /> {view.name}
        </h2>
        <Says lines={view.howTo} toad={40} />
        <Controls lines={view.controls} compact />
        {demo ? <div className={styles.phoneDemo}>{demo}</div> : null}
        <div className={styles.startBar}>
          <PrimaryButton done={me?.ready === true} onClick={onReady}>
            {me?.ready ? L('Ready!') : L('Start!')}
          </PrimaryButton>
          {me?.ready && !everyoneReady ? (
            <p className={styles.wait}>{L('Waiting for the others…')}</p>
          ) : null}
        </div>
      </section>
    );
  }
  return (
    <section className={styles.tv}>
      <Sheen />
      <h2 className={styles.title}>{view.name}</h2>
      {view.hasDemo ? <span className={styles.watermark}>{L('Practice Time!')}</span> : null}
      <span className={styles.badge} aria-hidden>
        <GameArt gameId={view.gameId} name={view.name} size="1em" />
      </span>
      {view.hasDemo ? (
        <div className={styles.window}>
          <div className={styles.scaled}>{demo}</div>
        </div>
      ) : (
        <div className={styles.window}>
          <PhonePic view={view} />
        </div>
      )}
      <div className={styles.side}>
        <Controls lines={view.controls} />
        {view.hasDemo ? <PhonePic view={view} /> : null}
      </div>
      <Says lines={view.howTo} toad={150} />
      <aside className={styles.rail} aria-label={L('Ready?')}>
        <p className={styles.start}>{everyoneReady ? L('Go!') : L('Waiting for everyone…')}</p>
        <ul className={styles.readyList}>
          {view.players.map((p) => (
            <li key={p.id} className={p.ready || p.bot ? styles.isReady : ''}>
              <Avatar avatarId={p.avatarId} size={72} dim={!p.connected} />
              <span className={styles.readyMark}>{p.ready || p.bot ? L('Ready!') : '…'}</span>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
