// The rhythm kit's chart (T-0636): the notes of a Rhythm Kitchen song and how a tap is judged against them. Pure: a
// chart is a function of the seed, a judgement a function of the tap's server time. Marks are one character per note:
// `.` still to come · `-` not this player's · `p` perfect (2 points) · `e` early, `l` late (1 point) · `x` missed ·
// `d` dry (the note it needed was missed: 0 points).
import { nextInt } from '@partybox/shared';
import type { RngState } from '@partybox/shared';

/** |tap − note| up to this is perfect (2 points); up to OK_MS is early or late (1 point). A phone's network is in there. */
export const PERFECT_MS = 120;
export const OK_MS = 300;
/** A tap that hit nothing locks that player's pad for this long (mashing earns nothing). */
export const STRAY_MS = 220;
/** The first note comes this long after the round began; the last is this long before it ends. */
export const LEAD_MS = 1800;
export const TAIL_MS = 1400;

export type Shape = 'steady' | 'pairs' | 'groups' | 'cues';

/** What a song is made of. `beatMs` is the beat of each third of the round (it speeds up). */
export interface RhythmStyle {
  /** steady: one pad, one note per step · pairs: two pads, a pickup then the action that needs it (Spread 'n Butter) ·
   *  groups: three ingredients roll in, then one push (Footlong Frenzy) · cues: each step lights some seats (Copycat Curry). */
  shape: Shape;
  /** The pads on the phone (1 or 2). */
  lanes: 1 | 2;
  beatMs: readonly [number, number, number];
  /** The kinds of note (what it looks like): its share of the notes and the beats of room it takes after it. */
  kinds: readonly { weight: number; beats: number }[];
  /** The chance (0-99) that a step is skipped for a beat's rest. */
  rest: number;
}

export interface Note {
  /** Milliseconds after the round began that it is due. */
  t: number;
  /** The pad that answers it; -1 is scenery that is never judged. */
  lane: number;
  /** An index into the skin's look for it. */
  kind: number;
  /** The index of an earlier note this one needs to have been hit (`d` when it was not). */
  need?: number;
  /** The seats (indexes in the seat order) that must answer it; absent: all of them. */
  who?: number[];
}

export interface Chart {
  notes: Note[];
  /** The beat at each moment, for the metronome and the track's grid. */
  beats: number[];
}

const pickKind = (rng: RngState, style: RhythmStyle): [number, RngState] => {
  const total = style.kinds.reduce((n, k) => n + k.weight, 0);
  let roll: number;
  let r = rng;
  [roll, r] = nextInt(r, 0, Math.max(0, total - 1));
  let kind = 0;
  for (let i = 0; i < style.kinds.length; i++) {
    roll -= style.kinds[i]?.weight ?? 0;
    if (roll < 0) {
      kind = i;
      break;
    }
  }
  return [kind, r];
};

/** A song of `ms` milliseconds for `seats` players: the same chart for everyone, a pure function of the rng. */
export function buildChart(
  rng: RngState,
  style: RhythmStyle,
  seats: number,
  ms: number,
): [Chart, RngState] {
  let r = rng;
  const notes: Note[] = [];
  const beats: number[] = [];
  const last = ms - TAIL_MS;
  let t = LEAD_MS;
  for (let guard = 0; t < last && guard < 400; guard++) {
    const level = Math.min(2, Math.floor((t * 3) / ms));
    const beat = style.beatMs[level] ?? 600;
    beats.push(t);
    let roll: number;
    [roll, r] = nextInt(r, 0, 99);
    if (roll < style.rest) {
      t += beat;
      continue;
    }
    let kind: number;
    [kind, r] = pickKind(r, style);
    const room = (style.kinds[kind]?.beats ?? 1) * beat;
    if (style.shape === 'pairs') {
      notes.push({ t, lane: 0, kind: 0 });
      notes.push({ t: t + beat, lane: 1, kind: 1, need: notes.length - 1 });
      t += beat + room;
    } else if (style.shape === 'groups') {
      for (let k = 0; k < 3; k++) {
        if (k > 0) [kind, r] = pickKind(r, style);
        notes.push({ t: t + k * beat, lane: -1, kind });
      }
      notes.push({ t: t + 3 * beat, lane: 0, kind: style.kinds.length });
      t += 3 * beat + room;
    } else if (style.shape === 'cues') {
      const who: number[] = [];
      for (let s = 0; s < seats; s++) {
        let pick: number;
        [pick, r] = nextInt(r, 0, 99);
        if (pick < 55) who.push(s);
      }
      if (who.length === 0) {
        let one: number;
        [one, r] = nextInt(r, 0, Math.max(0, seats - 1));
        who.push(one);
      }
      notes.push({ t, lane: 0, kind, who });
      t += room;
    } else {
      notes.push({ t, lane: 0, kind });
      t += room;
    }
  }
  return [{ notes, beats }, r];
}

/** The marks a player starts with: `.` for each note that is theirs to answer, `-` for the rest. */
export function freshMarks(chart: Chart, seat: number): string {
  return chart.notes
    .map((n) => (n.lane < 0 || (n.who !== undefined && !n.who.includes(seat)) ? '-' : '.'))
    .join('');
}

export const POINTS: Readonly<Record<string, number>> = { p: 2, e: 1, l: 1 };

/** A player's points: 2 for each perfect, 1 for each early or late. */
export const pointsOf = (marks: string): number => {
  let n = 0;
  for (const c of marks) n += POINTS[c] ?? 0;
  return n;
};

/** The most points a seat could win from this chart. */
export const maxPoints = (marks: string): number => {
  let n = 0;
  for (const c of marks) if (c !== '-') n += 2;
  return n;
};

const setMark = (marks: string, i: number, c: string): string =>
  marks.slice(0, i) + c + marks.slice(i + 1);

/** Every note whose window has closed by `t` and was never answered becomes a miss. */
export function settleMarks(chart: Chart, marks: string, t: number): string {
  let out = marks;
  for (let i = 0; i < chart.notes.length; i++)
    if (out[i] === '.' && (chart.notes[i]?.t ?? 0) + OK_MS < t) out = setMark(out, i, 'x');
  return out;
}

export interface Judged {
  marks: string;
  /** The note that was answered; null for a tap that hit nothing. */
  hit: number | null;
}

/** One tap on `lane` at `t` (ms after the round began): the nearest open note of that pad within OK_MS. */
export function judgeTap(chart: Chart, marks: string, lane: number, t: number): Judged {
  let best = -1;
  let gap = OK_MS + 1;
  for (let i = 0; i < chart.notes.length; i++) {
    const n = chart.notes[i];
    if (!n || marks[i] !== '.' || n.lane !== lane) continue;
    const d = Math.abs(t - n.t);
    if (d <= OK_MS && d < gap) {
      best = i;
      gap = d;
    }
  }
  const note = chart.notes[best];
  if (!note) return { marks, hit: null };
  const needed = note.need === undefined ? 'p' : (marks[note.need] ?? 'x');
  const mark = !'pel'.includes(needed) ? 'd' : gap <= PERFECT_MS ? 'p' : t < note.t ? 'e' : 'l';
  return { marks: setMark(marks, best, mark), hit: best };
}
