// The phone half of a Kaboom Squad game (T-0646): your points and the team's bar on top, the game's own controls under them.
// The game's Controller is `<KaboomController view send skin={skin(L)} Controls={Controls} />`.
import type { JSX } from 'react';
import type { Act, KaboomControllerView } from '../../kaboom/game';
import { WaitingScreen } from '../../controller/WaitingScreen';
import { useServerNow } from '../../ui/clock';
import { useT } from '../../ui/lang';
import { TeamBar } from './TeamBar';
import { STRINGS } from './strings';
import type { ControlsComponent, KaboomSkin } from './types';
import styles from './KaboomController.module.css';

export interface KaboomControllerProps<W> {
  view: KaboomControllerView<W>;
  send: (input: Act) => void;
  skin: KaboomSkin;
  Controls: ControlsComponent<W>;
}

export function KaboomController<W>({
  view,
  send,
  skin,
  Controls,
}: KaboomControllerProps<W>): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(80);
  const me = view.me.id;
  const mine = view.points[me] ?? 0;
  if (view.phaseId === 'done' || view.seat < 0) {
    return (
      <WaitingScreen title={skin.title}>
        {view.rank !== null ? (
          <p className={styles.result}>
            {L('Team rating: {grade}', { grade: view.grade })}
            <br />
            {L('Place {rank}', { rank: view.rank })} · {L('Points')} {mine}
          </p>
        ) : (
          <p>{L('Look at the TV')}</p>
        )}
      </WaitingScreen>
    );
  }
  return (
    <div className={styles.screen}>
      <p className={styles.kicker} aria-live="polite">
        {skin.title} · {L('You: {pts}', { pts: mine })}
      </p>
      <TeamBar
        team={view.team}
        max={view.max}
        cuts={view.cuts}
        grade={view.grade}
        unit={skin.unit}
        unitOne={skin.unitOne}
        caption={skin.scoreCaption === true}
      />
      <div className={styles.controls}>
        <Controls
          view={view}
          world={view.world}
          seat={view.seat}
          t={Math.max(0, now - view.began)}
          act={(a, b) => send({ type: 'act', a, b: b ?? 0 })}
        />
      </div>
    </div>
  );
}
