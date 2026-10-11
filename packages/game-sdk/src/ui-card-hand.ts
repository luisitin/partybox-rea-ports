// `@partybox/game-sdk/ui/card-hand` — the shared hand of cards for every card game (T-0342,
// docs/sdk/card-hand.md): a fan you arrange, sort and play from by dragging onto targets. A pack
// component on its own subpath, so it lands only in the chunks of the games that use it (audit #23).
export { CardHand } from './pack/card-hand/CardHand';
export { CardTable } from './pack/card-hand/CardTable';
export { CardDropTarget } from './pack/card-hand/CardDropTarget';
export { CardFace } from './pack/card-hand/CardFace';
export { CARD_ASPECT, fanLayout, moveIds, sortIds } from './pack/card-hand/handMath';
export type { FanLayout, Slot } from './pack/card-hand/handMath';
export type {
  CardDropTargetProps,
  CardFaceProps,
  CardHandProps,
  CardTableProps,
  HandCard,
  HandSort,
  SortCard,
} from './pack/card-hand/types';
