import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Input, State, Target } from '../server/types';

export const kit = testKit(game, { t0: 1_000_000, players: testPlayers(4) });

/** A known apex: fruit sit at y=30, the marked bomb is a separate lower lane. */
export function apex(extra: Partial<State> = {}): State {
  const state = kit.start();
  return {
    ...state,
    checked: 1000,
    phase: { ...state.phase, deadline: state.began + 1200 },
    fruit: [
      { id: 0, kind: 0, x: 20, drift: 0, peak: 30, bomb: false },
      { id: 1, kind: 1, x: 50, drift: 0, peak: 30, bomb: false },
      { id: 2, kind: 2, x: 80, drift: 0, peak: 30, bomb: false },
      { id: 3, kind: 4, x: 50, drift: 0, peak: 65, bomb: true },
    ],
    ...extra,
  };
}

export function swipe(state: State, extra: Partial<Input> = {}): Input {
  return {
    type: 'slice',
    wave: state.wave,
    frame: state.checked,
    seq: state.seats.p1!.lastSeq + 1,
    points: [
      { x: 10, y: 30 },
      { x: 90, y: 30 },
    ],
    ...extra,
  };
}

export const target = (extra: Partial<Target> = {}): Target => ({
  id: 0,
  kind: 0,
  bomb: false,
  x: 50,
  y: 50,
  radius: 7,
  ...extra,
});

export function withSeat(state: State, extra: Partial<State['seats'][string]>, id = 'p1'): State {
  return { ...state, seats: { ...state.seats, [id]: { ...state.seats[id]!, ...extra } } };
}

export function hit(
  state: State,
  extra: Partial<Input> = {},
  id = 'p1',
  now = state.began + state.checked,
): State {
  return kit.input(state, id, swipe(state, extra), now);
}
