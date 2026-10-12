// The TV half of a Kaboom Squad game (T-0646): the game's picture big, the team's bar with its S/A/B/C grade, everyone's
// points. The game's Tv is `<KaboomTv view skin={skin(L)} Scene={Scene} />`; the Scene is imported by the Tv only, so a phone
// never downloads TV art.
import type { JSX } from 'react';
import type { KaboomTvView } from '../../kaboom/game';
import { Avatar } from '../../ui/Avatar';
import { useServerNow } from '../../ui/clock';
import { useT } from '../../ui/lang';
import { BigText } from '../../tv/BigText';
import { Stage } from '../../tv/Stage';
import { TeamBar } from './TeamBar';
import { STRINGS } from './strings';
import type { KaboomSkin, SceneComponent } from './types';
import styles from './KaboomTv.module.css';

export interface KaboomTvProps<W> {
  view: KaboomTvView<W>;
  skin: KaboomSkin;
  Scene: SceneComponent<W>;
}

/** A seat's colour: the same one on the TV's scene, tally and the phone. */
export const seatHue = (seat: number): number => (seat * 47) % 360;

export function KaboomTv<W>({ view, skin, Scene }: KaboomTvProps<W>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(60);
  const done = view.phaseId === 'done';
  const t = done ? view.endsAt - view.began : Math.max(0, now - view.began);
  const rows = view.seats.map((id, seat) => {
    const p = view.players.find((x) => x.id === id);
    return {
      id,
      seat,
      name: p?.name ?? '',
      avatarId: p?.avatarId ?? '',
      connected: p?.connected ?? true,
      hue: seatHue(seat),
      pts: view.points[id] ?? 0,
    };
  });
  const best = Math.max(0, ...rows.map((r) => r.pts));
  return (
    <Stage center className={styles.room}>
      <div className={styles.head} data-done={done} data-grade={view.grade}>
        <BigText level={done ? 'h1' : 'h2'}>
          {done ? L('Team rating: {grade}', { grade: view.grade }) : skin.title}
        </BigText>
      </div>
      <div className={styles.scene} style={{ ['--hue' as string]: skin.hue }}>
        <div className={styles.fill}>
          <Scene
            view={view}
            world={view.world}
            t={t}
            done={done}
            players={rows.map((r) => ({
              id: r.id,
              name: r.name,
              hue: r.hue,
              connected: r.connected,
            }))}
          />
        </div>
      </div>
      <div className={styles.bar}>
        <TeamBar
          team={view.team}
          max={view.max}
          cuts={view.cuts}
          grade={view.grade}
          unit={skin.unit}
          unitOne={skin.unitOne}
          big
          caption={skin.scoreCaption === true}
        />
      </div>
      <ul className={styles.tally} aria-label={L('Points')}>
        {rows.map((r) => (
          <li key={r.id} data-lead={r.pts === best && best > 0} data-away={!r.connected}>
            <Avatar avatarId={r.avatarId} size="1.8rem" />
            <b>{r.name}</b>
            <span>{r.pts}</span>
          </li>
        ))}
      </ul>
    </Stage>
  );
}
