// `@partybox/game-sdk/kaboom` — the server half of the Kaboom Squad kit (T-0646, docs/sdk/kaboom.md).
export { GRADES, gradeOf, scaled, share } from './kaboom/grade';
export type { Cuts, Grade } from './kaboom/grade';
export { PHASES, STEP_MS, defineKaboomGame, inputSchema } from './kaboom/game';
export type {
  Act,
  KaboomControllerView,
  KaboomGameOptions,
  KaboomRules,
  KaboomState,
  KaboomTvView,
} from './kaboom/game';
