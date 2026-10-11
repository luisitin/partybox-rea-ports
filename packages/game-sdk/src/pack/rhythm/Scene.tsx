// The big prop behind the TV's beat track (T-0642, Jamboree's Rhythm Kitchen): each game draws one scene (a pot of soup, a
// cake, a burger stack) from its own glyphs and a few shapes, and the kit gives it the room's state and the reaction.
// TV only and decoration (aria-hidden): a game's scene file is imported by its `Tv.tsx` alone, so the phone never pays for it.
import type { ComponentType, CSSProperties, JSX, ReactNode } from 'react';
import { INK } from './art/Art';
import styles from './Scene.module.css';

/** What the kit tells a scene each time the room's points change. */
export interface RhythmSceneProps {
  /** Pieces in the team's tower, 0 to `TOWER_MAX`: the scene grows or fills with it. */
  tower: number;
  /** Counts up with every hit the room lands (0 before the first): a `SceneItem` replays its reaction when it changes. */
  n: number;
  /** The last hit was a perfect (a big reaction); false is an ok (a small one). */
  perfect: boolean;
}

export type RhythmScene = ComponentType<RhythmSceneProps>;

/** How a thing answers a hit: `pop` swells, `dip` plunges and lifts (a spoon, a knife), `spin` turns, `wobble` rocks, `bounce` jumps. */
export type SceneReaction = 'pop' | 'dip' | 'spin' | 'wobble' | 'bounce';

export interface SceneItemProps {
  /** Centre of the thing in the scene, percent of its box (0-100). */
  x: number;
  y: number;
  /** Glyph size in rem: a glyph is 1em square. */
  size: number;
  /** Tilt in degrees. */
  tilt?: number;
  /** Stacking: higher stands in front. */
  z?: number;
  /** The reaction and the hit count that replays it; both from the scene's props. */
  react?: SceneReaction;
  n?: number;
  perfect?: boolean;
  children: ReactNode;
}

/** One thing in a scene: placed by its centre, sized by `font-size`, and reacting to each hit when it has a `react`. */
export function SceneItem({
  x,
  y,
  size,
  tilt = 0,
  z = 0,
  react,
  n = 0,
  perfect = false,
  children,
}: SceneItemProps): JSX.Element {
  const place = {
    left: `${x}%`,
    top: `${y}%`,
    fontSize: `${size}rem`,
    zIndex: z,
    ['--tilt' as string]: `${tilt}deg`,
    ['--k' as string]: perfect ? 1 : 0.4,
  } as CSSProperties;
  return (
    <span className={styles.item} style={place}>
      <span
        key={react ? n : 0}
        className={styles.inner}
        data-react={react && n > 0 ? react : undefined}
      >
        {children}
      </span>
    </span>
  );
}

/** The box a scene is drawn in; the kit places it behind the track. */
export function SceneBox({ children }: { children: ReactNode }): JSX.Element {
  return <div className={styles.box}>{children}</div>;
}

/** A shape for a scene (a pot, a grill, a plate) on the glyphs' grid: 48 units are 1em, same ink outline, any width and height. */
export function SceneArt({
  w,
  h,
  children,
}: {
  w: number;
  h: number;
  children: ReactNode;
}): JSX.Element {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={`${w / 48}em`}
      height={`${h / 48}em`}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  );
}
