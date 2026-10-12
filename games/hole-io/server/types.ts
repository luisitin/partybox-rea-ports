// JSON state and public city model. All clocks inside the world are relative to began.
import { z } from '@partybox/game-sdk';
import type { ControllerView, GameStateBase, TvView } from '@partybox/game-sdk';

export const PHASES = ['play', 'reveal', 'done'] as const;
export const WIDTH = 180;
export const HEIGHT = 110;
export const ROUND_MS = 90_000;
export const STEP_MS = 100;
export const TICK_MS = 200;
export const REVEAL_MS = 7000;
export const RESPAWN_MS = 3000;
export const IMMUNE_MS = 2000;
export const RECYCLE_MS = 20_000;
export const SINK_MS = 700;
export const MAX_SINKS = 96;
export const inputSchema = z.object({
  type: z.literal('move'),
  x: z.number().finite().min(-1).max(1),
  y: z.number().finite().min(-1).max(1),
});
export type Input = z.infer<typeof inputSchema>;
export type PropKind = 'bin' | 'tree' | 'bench' | 'car' | 'house' | 'tower';
export interface CityProp {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  radius: number;
  points: number;
  availableAt: number;
}
export interface Hole {
  id: string;
  slot: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  mass: number;
  alive: boolean;
  eliminatedAt: number | null;
  eliminatedBy: string | null;
  score: number;
  swallowed: number;
  respawnAt: number | null;
  immuneUntil: number;
  lastGain: number;
  gainAt: number;
  inputAt: number;
  lastMoveAt: number;
}
export interface ConsumedProp extends Omit<CityProp, 'availableAt'> {
  by: string;
  consumedAt: number;
}
export interface World {
  holes: Hole[];
  props: CityProp[];
  cells: Record<string, number[]>;
  elapsed: number;
  sinks: ConsumedProp[];
}
export interface State extends GameStateBase {
  left?: string[];
  began: number;
  endsAt: number;
  world: World;
  phoneOnly: boolean;
  scores: Record<string, number>;
}
export interface HoleView {
  id: string;
  slot: number;
  x: number;
  y: number;
  radius: number;
  alive: boolean;
  level: number;
  growth: number;
  levelProgress: number;
  nextLevelAt: number | null;
  eliminatedAt: number | null;
  eliminatedBy: string | null;
  connected: boolean;
  left: boolean;
  score: number;
  swallowed: number;
  respawnIn: number;
  shield: boolean;
  lastGain: number;
}
export interface CityView {
  holes: HoleView[];
  props: CityProp[];
  sinks: ConsumedProp[];
}
export interface HoleTvView extends TvView {
  city: CityView;
  elapsed: number;
}
export interface HoleControllerView extends ControllerView {
  city: CityView;
  elapsed: number;
  participating: boolean;
  mine: HoleView | null;
  scores: Record<string, number>;
  slots: Record<string, number>;
  slot: number;
  rank: number | null;
  stage: boolean;
}

export function isParticipating(state: State, id: string): boolean {
  if (!Object.hasOwn(state.players, id) || state.left?.includes(id)) return false;
  const hole = state.world.holes.find((candidate) => candidate.id === id);
  return hole !== undefined && hole.alive !== false && hole.respawnAt === null;
}
