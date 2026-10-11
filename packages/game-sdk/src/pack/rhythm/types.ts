// What a Rhythm Kitchen game brings to the kit's screens: its look and its words, already translated by the game's own
// `useT` (so the Spanish lives in the game's strings.ts). Looks are drawn glyphs from `@partybox/game-sdk/ui/rhythm`, never emoji.
import type { ReactNode } from 'react';
export interface RhythmPad {
  /** The pad's word on the phone and the track's lane label. */
  label: string;
  icon: ReactNode;
}

export interface RhythmSkin {
  title: string;
  /** One line under the title on the TV. */
  rule: string;
  /** The game's colour, 0-360. */
  hue: number;
  /** The tool at the hit marker (a knife, a whisk, a shovel). */
  hit: ReactNode;
  /** What each kind of note looks like; a `groups` song has one more: the push. */
  kinds: readonly ReactNode[];
  /**
   * The kitchen behind the TV's track: `props` stand on the shelves around the title (3-4 of the game's own things), and
   * `pile` is the piece the team's stack grows from as the room scores (a bun, a pancake, a carrot).
   */
  scene: { props: readonly ReactNode[]; pile: ReactNode };
  /** One pad per lane. */
  pads: readonly RhythmPad[];
  /** How long a note of each kind is on its way (ms); default 1800. A faster pitch has a smaller number. */
  travelMs?: readonly number[];
}
