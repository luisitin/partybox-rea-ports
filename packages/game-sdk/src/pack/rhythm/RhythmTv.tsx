// The TV half of a Rhythm Kitchen game: the beat track big, everyone's points under it, the team's total and rating.
// The game's Tv is `<RhythmTv view skin={skin(L)} />`.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { RhythmTvView } from '../../rhythm/game';
import { Avatar } from '../../ui/Avatar';
import { useServerNow } from '../../ui/clock';
import { useT } from '../../ui/lang';
import { BigText } from '../../tv/BigText';
import { Stage } from '../../tv/Stage';
import { Kitchen, towerOf } from './Kitchen';
import type { RhythmScene } from './Scene';
import { Track } from './Track';
import type { Flash } from './Track';
import { ratingOf } from './rhythm';
import { STRINGS } from './strings';
import type { RhythmSkin } from './types';
import styles from './RhythmTv.module.css';

export interface RhythmTvProps {
  view: RhythmTvView;
  skin: RhythmSkin;
  /** The game's big prop behind the track (its `scene.tsx`, imported by the game's Tv only: TV-only art stays off the phone). */
  scene?: RhythmScene;
}

/** A hit flash for each time the room's points go up: a perfect (2) glows bigger than an ok (1). */
function useFlash(total: number): Flash {
  const before = useRef(total);
  const [flash, setFlash] = useState<Flash>({ n: 0, perfect: false });
  useEffect(() => {
    const gain = total - before.current;
    before.current = total;
    if (gain > 0) setFlash((f) => ({ n: f.n + 1, perfect: gain >= 2 }));
  }, [total]);
  return flash;
}

export function RhythmTv({ view, skin, scene }: RhythmTvProps): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(60, view.paused, view.clockHeldAt);
  const done = view.phaseId === 'done';
  const rows = view.players.map((p) => ({
    ...p,
    pts: view.scores[p.id] ?? 0,
    max: view.best[p.id] ?? 0,
  }));
  const best = Math.max(0, ...rows.map((r) => r.pts));
  const total = rows.reduce((n, r) => n + r.pts, 0);
  const possible = rows.reduce((n, r) => n + r.max, 0);
  const rating = ratingOf(total, possible);
  const flash = useFlash(total);
  return (
    <Stage center className={`${styles.room} ${done ? styles.roomDone : ''}`}>
      <Kitchen
        skin={skin}
        tower={towerOf(total, possible)}
        done={done}
        scene={scene}
        hits={flash.n}
        perfect={flash.perfect}
      />
      <div className={styles.head} data-done={done}>
        <BigText level="h1">
          {done ? L('Everyone together: {rating}', { rating: L(rating) }) : skin.title}
        </BigText>
      </div>
      {done ? null : (
        <div className={styles.track} data-scene={scene ? 'true' : undefined}>
          <Track
            chart={view.chart}
            t={now - view.began}
            skin={skin}
            players={view.players}
            seats={view.seats}
            flash={flash}
            big
          />
        </div>
      )}
      <ul className={styles.tally} aria-label={L('Points')}>
        {rows.map((r) => (
          <li key={r.id} data-lead={r.pts === best && best > 0} data-away={!r.connected}>
            <Avatar avatarId={r.avatarId} size="3rem" />
            <b>{r.name}</b>
            <span>{r.pts}</span>
          </li>
        ))}
      </ul>
      <BigText level="h2" tone="muted">
        {done
          ? L('Team score') + ': ' + L('{pts} of {max}', { pts: total, max: possible })
          : skin.rule}
      </BigText>
    </Stage>
  );
}
