// The phone's own drawing-pad style (I-021, the owner: "allow people to change the background and
// pencil style" — optional, per device): the paper under the strokes and how the strokes are
// painted. Stored in localStorage like the motion switch; nothing crosses the wire — the stored
// stroke data and the TV's rendering are the same whatever a phone chose. Read by Broken Pencil's
// DrawPad, set from the phone's settings sheet.
import { useSyncExternalStore } from 'react';

export type PadPaper = 'plain' | 'ruled';
export type PadPencil = 'pen' | 'pencil';
export interface PadStyle {
  paper: PadPaper;
  pencil: PadPencil;
}

/** The look the owner picked (I-021 C): ruled paper and a pencil; plain / pen one tap away. */
export const DEFAULT_PAD_STYLE: PadStyle = { paper: 'ruled', pencil: 'pencil' };

const PAD_KEY = 'partybox:pad';
const listeners = new Set<() => void>();
let cached: PadStyle | null = null;

function isPaper(v: unknown): v is PadPaper {
  return v === 'plain' || v === 'ruled';
}
function isPencil(v: unknown): v is PadPencil {
  return v === 'pen' || v === 'pencil';
}

export function getPadStyle(): PadStyle {
  if (cached) return cached;
  let style = DEFAULT_PAD_STYLE;
  try {
    const raw = localStorage.getItem(PAD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<keyof PadStyle, unknown>>;
      style = {
        paper: isPaper(parsed.paper) ? parsed.paper : DEFAULT_PAD_STYLE.paper,
        pencil: isPencil(parsed.pencil) ? parsed.pencil : DEFAULT_PAD_STYLE.pencil,
      };
    }
  } catch {
    /* private mode or bad JSON: the default */
  }
  cached = style;
  return style;
}

export function setPadStyle(patch: Partial<PadStyle>): void {
  cached = { ...getPadStyle(), ...patch };
  try {
    localStorage.setItem(PAD_KEY, JSON.stringify(cached));
  } catch {
    /* private mode: the choice lasts the session */
  }
  for (const l of listeners) l();
}

function subscribePad(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** This phone's pad style, live: the pad repaints when the settings sheet changes it. */
export function usePadStyle(): PadStyle {
  return useSyncExternalStore(subscribePad, getPadStyle, () => DEFAULT_PAD_STYLE);
}
