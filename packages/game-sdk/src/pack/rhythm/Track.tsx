// The beat track (T-0636): notes slide in from the right and meet the hit marker at their time. One component for the
// TV (everyone's song, the cues name seats) and the phone (only the notes that are yours). Drawn from `now - began`,
// nothing is streamed.
import type { CSSProperties, JSX } from 'react';
import type { ViewPlayer } from '@partybox/shared';
import type { Chart } from '../../rhythm/chart';
import { Avatar } from '../../ui/Avatar';
import { HIT_X, noteX } from './rhythm';
import type { RhythmSkin } from './types';
import styles from './Track.module.css';

/** The marker lights up each time `n` changes (a perfect brighter than an ok); 0 = nothing yet. */
export interface Flash {
  n: number;
  perfect: boolean;
}

export interface TrackProps {
  chart: Chart;
  /** Milliseconds since the round began (server time); negative before the first beat. */
  t: number;
  skin: RhythmSkin;
  /** One player's marks: the notes that are not theirs (`-`) are left off and judged ones are painted. */
  marks?: string;
  /** Seat order, to show whose cue a note is. */
  players?: readonly ViewPlayer[];
  seats?: readonly string[];
  flash?: Flash;
  /** Larger on the TV. */
  big?: boolean;
}

/** A note this far past the marker is gone; this far before the right edge it is not drawn yet. */
const GONE_MS = 450;
/** Past the marker a note fades out as it slides left, so it is gone before the track's left edge (T-0923). */
const EDGE_X = 4;
const lanesOf = (chart: Chart): number => Math.max(1, ...chart.notes.map((n) => n.lane + 1));

export function Track({
  chart,
  t,
  skin,
  marks,
  players,
  seats,
  flash,
  big,
}: TrackProps): JSX.Element {
  const lanes = Math.min(2, lanesOf(chart));
  const cells: JSX.Element[] = [];
  chart.notes.forEach((note, i) => {
    const mark = marks?.[i] ?? '.';
    if (mark === '-') return;
    if (note.t - t > (skin.travelMs?.[note.kind] ?? skin.travelMs?.[0] ?? 1800)) return;
    if (t - note.t > GONE_MS) return;
    const x = noteX(note, t, skin.travelMs);
    const row = Math.max(0, note.lane);
    // Past the marker a note fades out as it slides left (T-0923): by the edge it is gone, never cropped.
    const fade = Math.min(1, Math.max(0, (x - EDGE_X) / (HIT_X - EDGE_X)));
    const style: CSSProperties = { left: `${x}%`, top: `${((row + 0.5) / lanes) * 100}%` };
    const who = note.who?.map((seat) => players?.find((p) => p.id === seats?.[seat])) ?? [];
    cells.push(
      <span
        key={i}
        className={styles.note}
        style={{ ...style, ['--fade' as string]: fade }}
        data-mark={mark}
        data-scenery={note.lane < 0}
      >
        <span aria-hidden="true">{skin.kinds[note.kind] ?? skin.kinds[0]}</span>
        {who.length > 0 && (
          <span className={styles.who}>
            {who.map((p) => (p ? <Avatar key={p.id} avatarId={p.avatarId} size="1.2rem" /> : null))}
          </span>
        )}
      </span>,
    );
  });
  return (
    <div
      className={styles.track}
      data-big={big === true}
      data-lanes={lanes}
      style={{ ['--lanes' as string]: lanes, ['--hit' as string]: `${HIT_X}%` }}
      role="img"
      aria-label={skin.title}
    >
      {Array.from({ length: lanes }, (_, i) => (
        <span key={i}>
          <i className={styles.lane} style={{ top: `${((i + 0.5) / lanes) * 100}%` }} />
          <span
            key={flash?.n ?? 0}
            className={styles.ring}
            data-flash={flash && flash.n > 0 ? (flash.perfect ? 'perfect' : 'ok') : undefined}
            style={{ top: `${((i + 0.5) / lanes) * 100}%` }}
            aria-hidden="true"
          >
            {skin.hit}
          </span>
        </span>
      ))}
      {cells}
    </div>
  );
}
