import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State, Tower } from '../server/types';
import { DROP_MS, speedAt, SWING } from '../server/world';

export const T0 = 1_000_000;
export const kit = testKit(game, {
  t0: T0,
  players: [
    { id: 'a', name: 'Ana', avatarId: 'fox', connected: true },
    { id: 'b', name: 'Ben', avatarId: 'owl', connected: true },
    { id: 'c', name: 'Cleo', avatarId: 'frog', connected: true },
  ],
});

export function towerOf(state: State, id = 'a'): Tower {
  const tower = state.towers.find((item) => item.id === id);
  if (!tower) throw new Error(`Test has no tower for ${id}`);
  return tower;
}

/** Choose a crossing after the placement cooldown, without replacing the game judge. */
export function timeAtOffset(tower: Tower, offset: number, course = 0): number {
  const direction = (tower.height + course) % 2 === 0 ? 1 : -1;
  const inward = ((SWING + offset * direction) * 1000) / speedAt(tower.height);
  const outward = ((SWING * 3 - offset * direction) * 1000) / speedAt(tower.height);
  return tower.movingSince + (inward >= DROP_MS ? inward : outward);
}

export function replaceTower(state: State, tower: Tower): State {
  return {
    ...state,
    towers: state.towers.map((item) => (item.id === tower.id ? tower : item)),
    scores: { ...state.scores, [tower.id]: tower.best },
  };
}

export function place(state: State, offset = 0, id = 'a'): State {
  const tower = towerOf(state, id);
  return kit.input(
    state,
    id,
    { type: 'drop', attempt: tower.attempt, level: tower.height },
    timeAtOffset(tower, offset, state.course),
  );
}
