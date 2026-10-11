// `@partybox/game-sdk/ui/minigame` — the Superstars minigame sequence around any game (ADR-087,
// docs/sdk/minigame.md). Its own subpath (audit #23): only a board game that hosts minigames loads it.
export { MinigameFrame } from './pack/minigame/MinigameFrame';
export type { MinigameFrameProps } from './pack/minigame/MinigameFrame';
export { GameBadge, TapArt, badgeHue } from './pack/minigame/GameBadge';
export type { GameBadgeProps } from './pack/minigame/GameBadge';
export { GameArt } from './pack/minigame/GameArt';
export type { GameArtProps } from './pack/minigame/GameArt';
