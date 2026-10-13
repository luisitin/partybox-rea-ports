import { game } from '../server/index';
import type { Body, Input, State } from '../server/types';

export const T0 = 1_700_000_000_000;
export const NAMES = [
  'Alexandria Montgomery-Wellington',
  'Benjamin Constantinopoulos',
  'Chloë',
  'Davi',
  'Emilia',
  'Farid',
  'Gabrielle',
  'Hiro',
];
export function start(count = 8, seed = 1, halfSeconds?: number, phoneOnly = false): State {
  return game.init({
    players: Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      name: NAMES[i] ?? `Player ${i + 1}`,
      avatarId: 'fox',
      connected: true,
    })),
    settings: halfSeconds === undefined ? {} : { halfSeconds },
    seed,
    now: T0,
    presence: { mode: 'together', phoneOnly },
  });
}
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
export function input(state: State, id: string, patch: Partial<Input> = {}): Input {
  return {
    type: 'control',
    phaseAt: state.phase.startedAt,
    seq: (state.intents[id]?.seq ?? -1) + 1,
    dx: 0,
    dy: 0,
    kick: false,
    ...patch,
  };
}
export function control(
  state: State,
  id: string,
  patch: Partial<Input> = {},
  now = state.clock,
): State {
  return game.reduce(state, { type: 'input', now, playerId: id, input: input(state, id, patch) });
}
export function timer(state: State, now = state.phase.deadline ?? state.clock): State {
  return game.reduce(state, {
    type: 'timer',
    now,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
}
export function finishIdle(from: State): State {
  let state = from;
  for (let i = 0; i < 10_000 && state.phase.id !== 'done'; i++) {
    if (state.phase.deadline === null) throw new Error(`No exit clock in ${state.phase.id}`);
    state = timer(state, Math.max(state.clock, state.phase.deadline));
  }
  if (state.phase.id !== 'done') throw new Error('Idle match did not finish');
  return state;
}
export function isolated(from = start(2)): State {
  return {
    ...from,
    discs: from.discs.map((disc, i) => ({ ...disc, x: 30 + i * 80, y: 15, vx: 0, vy: 0 })),
    ball: { x: 80, y: 75, vx: 0, vy: 0 },
  };
}
export const body = (x: number, y: number, vx = 0, vy = 0): Body => ({ x, y, vx, vy });
