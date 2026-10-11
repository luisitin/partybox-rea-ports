// Two teams, always shown with shape, name and colour together (P00 §6): ▲ Sun (`--pb-team-sun`)
// and ● Moon (`--pb-team-moon`). Each side's score, a bar racing to the target, the active side's
// glow and an optional tag ("CATCH-UP!"). Membership is a shape and a band, never a tint on a face
// (audit #52). TV and phone sizes; a score that changes bumps once.
import type { CSSProperties, JSX, ReactNode } from 'react';
import styles from './TeamBanner.module.css';

export type BannerTeam = 'sun' | 'moon';

export interface TeamBannerProps {
  sun: number;
  moon: number;
  /** The score that wins ("First to 10"); the bars fill toward it. */
  winAt: number;
  active?: BannerTeam | null;
  /** A tag on the active side (the game's words, e.g. "CATCH-UP!"). */
  tag?: ReactNode;
  /** The game's words: the two names and the middle line. */
  words: { sun: string; moon: string; middle: ReactNode };
  size?: 'tv' | 'stage' | 'phone';
  className?: string;
}

function Side(props: {
  team: BannerTeam;
  name: string;
  score: number;
  winAt: number;
  active: boolean;
  tag?: ReactNode;
}): JSX.Element {
  const { team, name, score, winAt, active, tag } = props;
  const fill = Math.min(1, Math.max(0, winAt > 0 ? score / winAt : 0));
  return (
    <div
      className={`${styles.side} ${styles[team]} ${active ? styles.active : ''}`}
      style={{ '--fill': fill } as CSSProperties}
    >
      <span className={styles.glow} aria-hidden />
      <span className={styles.name}>
        <span className={styles.shape} aria-hidden>
          {team === 'sun' ? '▲' : '●'}
        </span>
        {name}
      </span>
      <span key={score} className={styles.score}>
        {score}
      </span>
      <span className={styles.track} aria-hidden>
        <span className={styles.bar} />
      </span>
      {active && tag ? <span className={styles.tag}>{tag}</span> : null}
    </div>
  );
}

export function TeamBanner(props: TeamBannerProps): JSX.Element {
  const { sun, moon, winAt, active = null, tag, words, size = 'tv', className } = props;
  return (
    <div className={`${styles.banner} ${styles[size]} ${className ?? ''}`}>
      <Side
        team="sun"
        name={words.sun}
        score={sun}
        winAt={winAt}
        active={active === 'sun'}
        tag={tag}
      />
      <span className={styles.middle}>{words.middle}</span>
      <Side
        team="moon"
        name={words.moon}
        score={moon}
        winAt={winAt}
        active={active === 'moon'}
        tag={tag}
      />
    </div>
  );
}
