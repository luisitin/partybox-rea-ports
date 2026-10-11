// Sound cues are the design system's vocabulary (docs/DESIGN_SYSTEM.md). The client shell owns
// the Web Audio synth and provides `play` through this context, so a game's Tv component can cue
// its own moments — a new bingo call, a wrong-answer buzzer, a fanfare — without knowing about
// audio at all. Outside a provider (previews, tests) every cue is silent.
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import type { JSX, ReactNode } from 'react';

export const CHESS_CUES = [
  'chess-move',
  'chess-capture',
  'chess-castle',
  'chess-check',
  'chess-promote',
  'chess-end',
  'chess-illegal',
  'chess-notify',
] as const;
export type ChessCue = (typeof CHESS_CUES)[number];

export const SOUND_CUES = [
  'ready',
  'start',
  'join',
  'phase',
  'countdown',
  'tick',
  'reveal',
  'card',
  'win',
  'pause',
  'leave',
  'fanfare',
  'cheer',
  'tie', // I-037 C: several winners — the win arpeggio landing on a held Csus4, crowd under it
  'silence',
  'jackpot',
  'bust',
  'sweep',
  'wager',
  'tally',
  'submit',
  'lock',
  'correct',
  'error',
  'wrong',
  'call',
  'daub',
  'claim',
  'dibs',
  'close',
  // T-0537: recorded foley for physical moments (a card laid, a tile set down, dice, chips).
  'flip',
  'clack',
  'dice',
  'chips',
  'draw', // a card taken from a pile into a hand: a soft shove
  'thud', // a hit: a dull impact (Battleship)
  'splash', // a miss in water (Battleship)
  // T-0517: Chess's own vocabulary. The sound set (chess.com recordings, soft wood or the classic
  // notes) decides what each one sounds like; the game only names the moment.
  ...CHESS_CUES,
] as const;

export type SoundCue = (typeof SOUND_CUES)[number];

export function isSoundCue(value: string): value is SoundCue {
  return (SOUND_CUES as readonly string[]).includes(value);
}

/** What a game may ask of a cue: `quiet` keeps it from standing in for the shell's phase chime
 *  (a background tick, not the moment); `gain` scales it (0..1) — a pluck under a hand-off, not
 *  on top of it (I-024). The shell may ignore either. */
export interface PlayCueOptions {
  quiet?: boolean;
  gain?: number;
}
export type PlayCue = (cue: SoundCue, opts?: PlayCueOptions) => void;

export interface ClipOptions {
  /** Start this far into the clip (skip a recording's leading silence) — seconds. */
  offsetS?: number;
  /** 0..1, default 1. */
  gain?: number;
  /** Start this many ms after the call (a cue may lead). */
  delayMs?: number;
  /** false: the music stays where it is under this clip (Blanks' readings — the owner,
   *  2026-09-23: quiet music the whole time, not a dip and a swell around every card). */
  duck?: boolean;
  /** true: this clip is the game's own music bed. The TV steps back from it when the phones play
   *  the music (a phone-only room, "music on every phone"), unless the VIP chose TV and phones
   *  (T-0376). */
  bed?: boolean;
}

/**
 * What a game's Tv gets from the shell: `play` a design-system cue; `clip` a recorded file under
 * /sfx (a bingo call), through the same graph — mute, master level; `hush` stops every clip, or with
 * `fadeMs` ducks them out over that long and returns the wait until they are silent.
 */
export interface SoundApi {
  play: PlayCue;
  clip: (src: string, opts?: ClipOptions) => void;
  hush: (fadeMs?: number) => number;
}

/** A reading that cuts another one ducks it out over this long, so no sentence stops mid-word. */
export const READING_FADE_MS = 250;

const SILENT: SoundApi = { play: () => undefined, clip: () => undefined, hush: () => 0 };
const SoundContext = createContext<SoundApi>(SILENT);

export function SoundProvider({
  play,
  clip,
  hush,
  children,
}: {
  play: PlayCue;
  clip?: SoundApi['clip'];
  hush?: SoundApi['hush'];
  children: ReactNode;
}): JSX.Element {
  // One stable object per set of functions: consumers key effects on it (a new object every
  // render would replay a game's "new call" effect on every push).
  const value = useMemo<SoundApi>(
    () => ({ play, clip: clip ?? SILENT.clip, hush: hush ?? SILENT.hush }),
    [play, clip, hush],
  );
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

/** The shell's `play(cue)`; a no-op when no shell provides one. */
export function useSound(): PlayCue {
  return useContext(SoundContext).play;
}

/** The whole shell audio API (cues + recorded clips). */
export function useSoundApi(): SoundApi {
  return useContext(SoundContext);
}

// ── the reader (ADR-045, audit #8) ───────────────────────────────────────────────────────────
// On the device that speaks: the TV, or a phone in a phone-only room (the shell hands it `clip`).
// `useReading` plays the view's current line once per key, the moment it is up (`useSay`, for lines
// at server times, is in say.ts). It never runs two readings at once: a voice still speaking fades
// out over READING_FADE_MS and the new one starts when it is silent, so no sentence is cut mid-word.
// The music stays quietly under the voice (the owner, 2026-09-23). Here, not in a file of its own,
// so it rides the entry chunk every shell loads instead of a small shared chunk each game downloads.
export interface ReadingOptions {
  /** False on a device that stays quiet (a phone outside a phone-only room). Default true. */
  on?: boolean;
  /** The clip starts this much later but claims the moment now: the shell's phase chime yields
   *  to it (a card's cue leading the voice). */
  delayMs?: number;
  /** The call itself waits this long (cancelled when the line changes first), so the shell's
   *  phase chime rings before the voice. The line counts as said only once it plays. */
  holdMs?: number;
}

/**
 * Plays a made line (`{ key, url }`; null or an empty key while there is none) once per key for as
 * long as the component is mounted: a stage that remounts every phase says "Close!" again next
 * round, while a view pushed again within a phase never repeats its line.
 */
export function useReading(
  reading: { key: string; url: string } | null | undefined,
  { on = true, delayMs = 0, holdMs = 0 }: ReadingOptions = {},
): void {
  const sound = useSoundApi();
  const said = useRef(new Set<string>());
  const key = on ? reading?.key || null : null;
  const url = reading?.url || null;
  useEffect(() => {
    if (!key || !url || said.current.has(key)) return undefined;
    const play = (): void => {
      said.current.add(key);
      // Never two readings at once: a voice still speaking fades out, and this one starts when it is
      // silent. The claim is made now, so the phase chime still yields to it.
      const lead = delayMs + sound.hush(READING_FADE_MS);
      sound.clip(url, { gain: 1, duck: false, ...(lead > 0 ? { delayMs: lead } : {}) });
    };
    if (holdMs <= 0) {
      play();
      return undefined;
    }
    const handle = setTimeout(play, holdMs);
    return () => clearTimeout(handle);
  }, [key, url, delayMs, holdMs, sound]);
}
