// `@partybox/game-sdk/ui/kaboom` — the screens of a Kaboom Squad game (T-0646, docs/sdk/kaboom.md): the TV and phone frames, the
// team bar and the phone's button. Games wrap them with their skin, a TV Scene and phone Controls; the rules are
// `@partybox/game-sdk/kaboom`.
export { KaboomController } from './pack/kaboom/KaboomController';
export type { KaboomControllerProps } from './pack/kaboom/KaboomController';
export { KaboomTv, seatHue } from './pack/kaboom/KaboomTv';
export type { KaboomTvProps } from './pack/kaboom/KaboomTv';
export { TeamBar } from './pack/kaboom/TeamBar';
export type { TeamBarProps } from './pack/kaboom/TeamBar';
export { SeatDots } from './pack/kaboom/SeatDots';
export type { DotState, SeatDotsProps } from './pack/kaboom/SeatDots';
export { ActButton } from './pack/kaboom/ActButton';
export type { ActButtonProps } from './pack/kaboom/ActButton';
export { STRINGS as KABOOM_STRINGS } from './pack/kaboom/strings';
export type {
  ControlsComponent,
  ControlsProps,
  KaboomSkin,
  SceneComponent,
  SceneProps,
} from './pack/kaboom/types';
export { Art, INK } from './pack/rhythm/art/Art';
