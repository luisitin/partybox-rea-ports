// This phone's own sound and music switches, for a game's in-game settings menu (the owner,
// 2026-09-24: "a button where I can turn my music on or off"). The switches live in the controller
// shell (packages/client: the phone's mute and phone-music choice); the shell provides them here so
// a game can offer the same two rows without importing the shell. Vibration and motion are already
// in the SDK (`hapticsEnabled` / `setHapticsEnabled`, `useMotionOff` / `setMotionOff`).
// Without a shell (tests, /preview) both switches read "off" and do nothing.
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type { JSX, ReactNode } from 'react';

export interface PhoneSwitch {
  on: boolean;
  set: (on: boolean) => void;
}

export interface PhonePrefs {
  /** Music playing on this phone (its own choice wins over the room's). */
  music: PhoneSwitch;
  /** This phone's music volume, 0..1 (a game that plays its own music scales by it). */
  musicVolume: number;
  /** This phone's sound cues and readings. */
  sound: PhoneSwitch;
  /** False when the shell did not provide the switches (hide the rows). */
  available: boolean;
}

const OFF: PhoneSwitch = { on: false, set: () => undefined };
const NONE: PhonePrefs = { music: OFF, musicVolume: 1, sound: OFF, available: false };
const PrefsContext = createContext<PhonePrefs>(NONE);

export function PhonePrefsProvider({
  value,
  children,
}: {
  value: Omit<PhonePrefs, 'available'>;
  children: ReactNode;
}): JSX.Element {
  return (
    <PrefsContext.Provider value={{ ...value, available: true }}>{children}</PrefsContext.Provider>
  );
}

export function usePhonePrefs(): PhonePrefs {
  return useContext(PrefsContext);
}

// ── a choice this phone remembers (ABSTRACTION_AUDIT #23, the audit's `usePhonePref`) ─────────
// A card style, a hand layout, a board layout: kept in localStorage and in memory, so private mode
// (where writes throw) still keeps the choice for the page; every component reading the key
// re-renders when it changes. Beside the shell's own switches (`usePhonePrefs`) above.
const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function stored(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** The remembered choice for `key` when it is one of `choices`, else `fallback`. */
export function readStoredChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): T {
  const v = stored(key);
  return choices.includes(v as T) ? (v as T) : fallback;
}

/** Remembers `value` for `key` (for the page at least) and tells every reader. */
export function writeStoredChoice(key: string, value: string): void {
  memory.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // private mode: the choice lasts the page
  }
  for (const l of listeners.get(key) ?? []) l();
}

/** Calls `fn` whenever `key` is written; returns the unsubscribe. */
export function subscribeStoredChoice(key: string, fn: () => void): () => void {
  const set = listeners.get(key) ?? new Set<() => void>();
  listeners.set(key, set);
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

/** The remembered choice, live: re-renders when any component writes `key`. */
export function useStoredChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): T {
  const subscribe = useCallback((fn: () => void) => subscribeStoredChoice(key, fn), [key]);
  return useSyncExternalStore(
    subscribe,
    () => readStoredChoice(key, choices, fallback),
    () => fallback,
  );
}
