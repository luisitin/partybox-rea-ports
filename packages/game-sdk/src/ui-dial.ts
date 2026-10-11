// `@partybox/game-sdk/ui/dial` — the dial family (P00 §6: Dial + DialInput, owned by Tune In).
// Its own subpath (audit #23) so it lands in the games that use it, never in the app's entry chunk.
export { Dial } from './pack/dial/Dial';
export type { DialMarker, DialProps } from './pack/dial/Dial';
export { DialInput } from './pack/dial/DialInput';
export type { DialInputMark, DialInputProps } from './pack/dial/DialInput';
export { DialStrip } from './pack/dial/DialStrip';
export type { DialStripMark, DialStripProps } from './pack/dial/DialStrip';
export {
  createThrottle,
  posFromPoint,
  posFromX,
  posToDeg,
  stackRings,
  wedges,
} from './pack/dial/geometry';
export type { Wedge } from './pack/dial/geometry';
