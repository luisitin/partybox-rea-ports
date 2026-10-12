import type { GameEvent, PlayerInfo } from '@partybox/game-sdk';
import { game } from '../server/index';
import type { CityProp, Hole, Input, State, World } from '../server/types';
import { indexProps } from '../server/world';

export const T0 = 1_000_000;
export const players = (n = 2): PlayerInfo[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    avatarId: 'fox',
    connected: true,
  }));
export const start = (n = 2, seed = 1, phoneOnly = false): State =>
  game.init({
    players: players(n),
    seed,
    now: T0,
    settings: {},
    presence: { mode: 'together', phoneOnly },
  });
export const hole = (id = 'p1', extra: Partial<Hole> = {}): Hole => ({
  id,
  slot: 0,
  x: 50,
  y: 50,
  dx: 0,
  dy: 0,
  mass: 0,
  score: 0,
  swallowed: 0,
  respawnAt: null,
  immuneUntil: 0,
  lastGain: 0,
  gainAt: -2000,
  inputAt: -1,
  ...extra,
});
export const prop = (extra: Partial<CityProp> = {}): CityProp => ({
  id: 0,
  kind: 'bin',
  x: 50,
  y: 50,
  radius: 1,
  points: 2,
  availableAt: 0,
  ...extra,
});
export const world = (holes: Hole[], props: CityProp[] = [], elapsed = 0): World => ({
  holes,
  props,
  elapsed,
  cells: indexProps(props),
});
export const timer = (state: State, now = state.phase.deadline ?? T0): State =>
  game.reduce(state, {
    type: 'timer',
    now,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
export const move = (state: State, id: string, x: number, y: number, now = T0): State =>
  game.reduce(state, {
    type: 'input',
    playerId: id,
    now,
    input: { type: 'move', x, y },
  });
export const vip = (
  state: State,
  action: Extract<GameEvent<Input>, { type: 'vip' }>['action'],
  now: number,
): State => game.reduce(state, { type: 'vip', action, now });
export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
