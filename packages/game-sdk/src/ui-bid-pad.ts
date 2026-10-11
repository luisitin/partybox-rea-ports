// `@partybox/game-sdk/ui/bid-pad` — the BidPad (P00 §6), on its own subpath so only the game that
// uses it downloads it (game-pack audit #23: everything in the `ui` barrel lands in the entry).
export { BidPad } from './pack/bid-pad/BidPad';
export type { BidPadProps, BidPadTexts } from './pack/bid-pad/BidPad';
export { addBid, chipTargets, clampBid, stepBid } from './pack/bid-pad/bidPadMath';
