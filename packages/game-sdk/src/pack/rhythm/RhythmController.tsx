// The phone half of a Rhythm Kitchen game: your track, your pads, how the last tap went. The game's Controller is
// `<RhythmController view send skin={skin(L)} />`.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { RhythmControllerView, Tap } from '../../rhythm/game';
import { useServerNow } from '../../ui/clock';
import { useT } from '../../ui/lang';
import { WaitingScreen } from '../../controller/WaitingScreen';
import { Pad } from './Pad';
import { Track } from './Track';
import { newestVerdict } from './rhythm';
import type { Verdict } from './rhythm';
import { STRINGS } from './strings';
import type { RhythmSkin } from './types';
import styles from './RhythmController.module.css';

export interface RhythmControllerProps {
  view: RhythmControllerView;
  send: (input: Tap) => void;
  skin: RhythmSkin;
}

/** The newest judgement on your marks, held for a moment. */
function useVerdict(marks: string): { text: Verdict; n: number } | null {
  const before = useRef(marks);
  const [shown, setShown] = useState<{ text: Verdict; n: number } | null>(null);
  useEffect(() => {
    const text = newestVerdict(before.current, marks);
    before.current = marks;
    if (text) setShown((old) => ({ text, n: (old?.n ?? 0) + 1 }));
  }, [marks]);
  return shown;
}

export function RhythmController({ view, send, skin }: RhythmControllerProps): JSX.Element {
  const L = useT(STRINGS);
  const now = useServerNow(80, view.paused, view.clockHeldAt);
  const me = view.me.id;
  const marks = view.marks[me] ?? '';
  const verdict = useVerdict(marks);
  const seat = view.seats.indexOf(me);
  if (view.phaseId === 'done' || seat < 0) {
    const rank = view.rank;
    return (
      <WaitingScreen title={skin.title}>
        {rank !== null ? (
          <p className={styles.result}>
            {L('Place {rank}', { rank })} ·{' '}
            {L('{pts} of {max}', {
              pts: view.scores[me] ?? 0,
              max: view.best[me] ?? 0,
            })}
          </p>
        ) : (
          <p>{L('Look at the TV')}</p>
        )}
      </WaitingScreen>
    );
  }
  const t = now - view.began;
  const cued = view.chart.notes.some((n) => n.who !== undefined);
  const mineSoon =
    !cued || view.chart.notes.some((n, i) => marks[i] === '.' && n.t - t > -300 && n.t - t < 1200);
  return (
    <div className={styles.screen}>
      <p className={styles.kicker} aria-live="polite">
        {skin.title} · {L('Points')} {view.scores[me] ?? 0}
      </p>
      <Track chart={view.chart} t={t} skin={skin} marks={marks} />
      <p className={styles.verdict} data-cue={cued && mineSoon} key={verdict?.n ?? 0} role="status">
        {cued ? (mineSoon ? L('Your cue!') : L('Wait for your cue')) : null}
        {verdict ? <b data-v={verdict.text}>{L(verdict.text)}</b> : null}
      </p>
      <Pad
        pads={skin.pads}
        onTap={(lane) => send({ type: 'tap', lane })}
        locked={t < view.lockedUntil}
      />
    </div>
  );
}
