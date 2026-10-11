// S-005 / the owner (2026-09-22): "some games still reference the TV and are not adjusted to work
// well on phone only". The shell says whether the room is "phone only", so the SDK's own controls
// (ChoiceGrid, VoteList, TextAnswer) pick defaults that never send a player to a TV that is not
// there. A game can read it too — `usePhoneOnly()` — instead of threading `view.phoneOnly` down.
import { createContext, useContext } from 'react';
import type { JSX, ReactNode } from 'react';
import type { Translator } from '../ui/lang';

const PhoneOnlyContext = createContext(false);

export function PhoneOnlyProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}): JSX.Element {
  return <PhoneOnlyContext.Provider value={value}>{children}</PhoneOnlyContext.Provider>;
}

/**
 * True when this phone is the stage: a "phone only" room (no TV to look at), or — ADR-047 — this
 * player can't see the room's TV (remote). False outside any shell (previews).
 */
export function usePhoneOnly(): boolean {
  return useContext(PhoneOnlyContext);
}

/** ADR-047: whether this player can look at the TV — the words for "look at the TV" follow it. */
export function useCanSeeTv(): boolean {
  return !useContext(PhoneOnlyContext);
}

/** The SDK's default lines, with and without a TV in the room, in the device's language (`L`,
 *  the caller's `useT(STRINGS)`). */
export const SDK_LINES = {
  lockedIn: (phoneOnly: boolean, L: Translator): string =>
    phoneOnly ? L('✓ Locked in') : L('✓ Locked in — look at the TV'),
  voteIn: (phoneOnly: boolean, L: Translator): string =>
    phoneOnly ? L('✓ Vote in') : L('✓ Vote in — look at the TV'),
  waiting: (phoneOnly: boolean, L: Translator): string =>
    phoneOnly ? L('Waiting for the others…') : L('Waiting for the others — look at the TV'),
  // The input goes to the host, not the TV; with no TV in the room, say it plainly.
  retry: (phoneOnly: boolean, L: Translator): string =>
    phoneOnly ? L("✗ Didn't go through — tap again") : L("✗ Didn't reach the TV — tap again"),
};
