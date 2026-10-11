// The kitchen behind the TV's beat track (T-0636, Jamboree's Rhythm Kitchen): a tiled wall in the game's colour, a shelf of
// the game's own things on each side of the title, a counter along the bottom, and the team's stack: a tower of the
// game's piece that grows as the room scores, one piece at a time (big on the done screen), and the game's big prop
// (`scene`) behind the track, which answers each hit (gone on the done screen, where the tower is the trophy). Decoration only: nothing here is read out.
import { memo } from 'react';
import type { JSX } from 'react';
import { SceneBox } from './Scene';
import type { RhythmScene } from './Scene';
import type { RhythmSkin } from './types';
import styles from './Kitchen.module.css';

/** The tower is full when the team has won every point there was. */
export const TOWER_MAX = 6;

/** How many pieces the tower has: the team's share of the points there were, 0 to `TOWER_MAX`. */
export function towerOf(points: number, possible: number): number {
  if (possible <= 0 || points <= 0) return 0;
  return Math.min(TOWER_MAX, Math.max(1, Math.round((points / possible) * TOWER_MAX)));
}

export interface KitchenProps {
  skin: RhythmSkin;
  /** Pieces in the tower. */
  tower: number;
  /** The done screen: the tower stands big in the middle as the room's trophy. */
  done?: boolean;
  /** The game's big prop behind the track (T-0642), and the room's hits so far for it to answer. */
  scene?: RhythmScene;
  hits?: number;
  perfect?: boolean;
}

function KitchenView({
  skin,
  tower,
  done,
  scene: Scene,
  hits = 0,
  perfect = false,
}: KitchenProps): JSX.Element {
  const half = Math.ceil(skin.scene.props.length / 2);
  return (
    <div
      className={styles.kitchen}
      data-done={done ? 'true' : undefined}
      style={{ ['--hue' as string]: skin.hue }}
      aria-hidden="true"
    >
      <div className={styles.shelf} data-side="left">
        {skin.scene.props.slice(0, half).map((p, i) => (
          <span key={i}>{p}</span>
        ))}
      </div>
      <div className={styles.shelf} data-side="right">
        {skin.scene.props.slice(half).map((p, i) => (
          <span key={i}>{p}</span>
        ))}
      </div>
      {Scene && !done ? (
        <div className={styles.stage}>
          <div
            className={styles.glow}
            key={hits}
            data-perfect={perfect && hits > 0 ? 'true' : undefined}
          />
          <SceneBox>
            <Scene tower={tower} n={hits} perfect={perfect} />
          </SceneBox>
        </div>
      ) : null}
      <div className={styles.counter} />
      <div className={styles.spares} data-done={done ? 'true' : undefined}>
        <div className={styles.tower} data-done={done ? 'true' : undefined}>
          {Array.from({ length: tower }, (_, i) => (
            <span key={i} data-top={i === tower - 1}>
              {skin.scene.pile}
            </span>
          ))}
        </div>
        {/* The spares stand on a labelled tray on the counter, inside the TV (T-0923): not floating above it. */}
        <div className={styles.tray}>
          <span>×{tower}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Re-renders only when the room scores: the TV ticks every 60 ms for the track and the kitchen need not follow. A `Tv` builds
 * its skin anew on every render, so the skin is compared by its hue alone: the shelf and tower glyphs are the game's fixed art
 * (only the title and rule are translated, and they are not read here), so they cannot change while the hue stays.
 */
function same(a: KitchenProps, b: KitchenProps): boolean {
  return (
    a.skin.hue === b.skin.hue &&
    a.tower === b.tower &&
    a.done === b.done &&
    a.scene === b.scene &&
    a.hits === b.hits &&
    a.perfect === b.perfect
  );
}

export const Kitchen = memo(KitchenView, same);
