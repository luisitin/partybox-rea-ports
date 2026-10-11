// CardHand's API (T-0342, docs/sdk/card-hand.md). Kept apart from the components so a game can be
// written against it while the gestures land.
import type { ReactNode } from 'react';

/** What sorting needs from a card. */
export interface SortCard {
  /** Stable for the card's life (the server's card id): the arrangement and selection follow it. */
  id: string;
  /** What "sort by number" orders by. A wild or an action card: a high number puts it last. */
  rank: number;
  /** What "sort by colour" groups by: a colour or suit key (`suitOrder` sets their order). */
  suit: string;
}

/** One card in a hand, as the game describes it to CardHand. */
export interface HandCard extends SortCard {
  /** Its spoken name, already translated ("Red 7", "Wild"). */
  label: string;
  /** The face, drawn inside CardHand's card frame: CardFace, or the game's own art (an <svg> or
   *  <img> is stretched to fill the card; with `frame="art"` it is the whole card). */
  face: ReactNode;
}

/** A sort button: built in ('rank' 1 2 3, 'suit' colour, 'sets' equal numbers together) or the
 *  game's own (Phase 10's "Phase": the cards of the current phase first, group by group). */
export type HandSort =
  | 'rank'
  | 'suit'
  | 'sets'
  | {
      id: string;
      /** Already translated: the button's words. */
      label: string;
      icon?: ReactNode;
      /** The ids in the order this sort puts them. */
      order: (cards: readonly SortCard[]) => readonly string[];
    };

export interface CardHandProps {
  cards: readonly HandCard[];
  /** The hand's name for screen readers ("Your cards"). */
  label: string;
  /** Tapping selects several cards (Phase 10 lays a group). Default: one at a time (Uno). */
  multi?: boolean;
  /** Cards that glow: playable now (Uno), or the ones the goal needs (Phase 10). */
  highlight?: readonly string[];
  /** What a glowing card is, for screen readers, already translated ("playable"). */
  highlightLabel?: string;
  /** Cards drawn darker: not playable now. They still move, sort and select. */
  dimmed?: readonly string[];
  /** The sort buttons, in order; [] hides the bar. Default ['rank', 'suit']. */
  sorts?: readonly HandSort[];
  /** The colour order for 'suit' and tie breaks (default: first seen in the hand). */
  suitOrder?: readonly string[];
  /** Keeps the arrangement across a reload of this tab, e.g. `phase-10:${me.id}`. */
  persistKey?: string;
  /** Card width / height. Default 5 / 7 (a poker card); the owner's Uno art is 76 / 126. */
  aspect?: number;
  /** 'paper' (default): CardHand draws a cream card and the face sits on it (CardFace).
   *  'art': the face is the whole card, edge to edge (an <svg> or <img> of full card art); CardHand
   *  adds only the shadow, the rings and the motion. */
  frame?: 'paper' | 'art';
  /** The card's corner radius as a share of its width, so the shadow and rings follow the art's
   *  corners. Default 0.09. */
  radius?: number;
  /** A target id: tapping a picked card again puts it there (Uno: tap to lift, tap again to play). */
  tapAgain?: string;
  /** Tapping a dimmed card shakes it and calls this instead of picking it, so the game can say why
   *  ("Needs red or a 7"). Without it a dimmed card picks like any other. */
  onDimmedTap?: (id: string) => void;
  /** The hand fills this element's box: give it a height (flex: 1, or a share of the screen). */
  className?: string;
}

export interface CardTableProps {
  children: ReactNode;
  /** The selected ids, when the game holds them (to show "Skip whom?" for a picked Skip).
   *  Omit both to let CardTable keep them. A drop clears the selection. */
  selected?: readonly string[];
  onSelect?: (ids: string[]) => void;
  className?: string;
}

export interface CardDropTargetProps {
  /** Unique within its CardTable. */
  id: string;
  /** Its name for screen readers ("Discard pile", "Ana's run, left end"), already translated. */
  label: string;
  /** Whether these cards (in hand order) may go here now. While a drag or a selection is on, a
   *  target that takes them glows; one that does not turns red under the card and refuses it. */
  accepts: (ids: readonly string[]) => boolean;
  /** The cards were put here: dragged in, or tapped in after selecting them. Send the input here.
   *  CardHand keeps them hidden until the next view drops them from the hand, or 2.5 s pass.
   *  Return `false` when the game needs more first (Uno's Wild asks for a colour): the cards stay
   *  in the hand, nothing hides or flies, and the game sends the play when it has the rest. */
  onDrop: (ids: readonly string[]) => void | false;
  /** Cards it refused (`accepts` said no to a drop on it, or to a tap with cards picked): say why
   *  ("A set needs three of one number"). The cards have already sprung home with a buzz. */
  onRefuse?: (ids: readonly string[]) => void;
  /** A tap with nothing selected that it accepts (the draw pile: draw a card). */
  onTap?: () => void;
  /** Off for good (not your turn): no glow, no tap. */
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}

/** The look of a card's face. */
export interface CardFaceProps {
  /** The corner index, top left and (turned) bottom right: "7", "W", "+2". */
  index: string;
  /** The big middle; default the index. */
  centre?: ReactNode;
  /** The ink: a CSS colour or var (the card's colour). */
  ink: string;
  /** 'paper' (white card, coloured ink: Phase 10), 'solid' (coloured card, white oval: Uno),
   *  'rainbow' (a wild). Default 'paper'. */
  look?: 'paper' | 'solid' | 'rainbow';
  /** A small shape beside the corner index, so colour is never the only cue. */
  mark?: ReactNode;
}
