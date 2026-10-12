// Timer wakes are coarser than physics; deadline is rearmed and views show the true round end.
import { enterPhase, hasPlayer, isTimerFor, nextStep } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { MIN_MASS, ROUND_MS } from '../types';
import type { Input, State, Transition } from '../types';
import { makeWorld, tick } from '../world';

export const WAKE_MS = 100;

export function enterPlay(state: State, now: number, round = state.round): State {
  const [fresh, rng] = makeWorld(Object.keys(state.players), state.rng);
  const world = {
    ...fresh,
    snakes: fresh.snakes.map((s) =>
      state.players[s.id]!.connected ? s : { ...s, body: [], mass: MIN_MASS, respawnAt: 0 },
    ),
  };
  return enterPhase(
    { ...state, world, rng, round, began: now, endsAt: now + ROUND_MS },
    'play',
    now,
    WAKE_MS,
  );
}

export function settle(state: State, now: number): State {
  const to = Math.max(0, Math.min(ROUND_MS, now - state.began));
  const [world, rng] = tick(
    state.world,
    state.rng,
    to,
    Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, p.connected])),
  );
  return world === state.world ? state : { ...state, world, rng };
}

export function advancePlay(state: State, now: number, next: Transition): State {
  const s = settle(state, now);
  return now >= s.endsAt
    ? next(s, now)
    : nextStep(s, Math.min(s.endsAt, s.began + s.world.elapsed + WAKE_MS));
}

export function reducePlay(state: State, event: GameEvent<Input>, next: Transition): State {
  if (event.type === 'timer')
    return isTimerFor(state, event) && event.now >= (state.phase.deadline ?? Infinity)
      ? advancePlay(state, event.now, next)
      : state;
  if (
    event.type !== 'input' ||
    !hasPlayer(state, event.playerId) ||
    !state.players[event.playerId]!.connected ||
    event.now < state.began + state.world.elapsed
  )
    return state;
  const s = settle(state, event.now);
  if (event.now >= s.endsAt) return next(s, event.now);
  const snake = s.world.snakes.find((x) => x.id === event.playerId);
  if (
    !snake ||
    snake.respawnAt !== null ||
    (snake.target === event.input.angle && snake.boost === event.input.boost)
  )
    return s;
  return {
    ...s,
    world: {
      ...s.world,
      snakes: s.world.snakes.map((x) =>
        x.id === event.playerId
          ? {
              ...x,
              target: event.input.angle,
              boost: event.input.boost,
              steeredAt: s.world.elapsed,
            }
          : x,
      ),
    },
  };
}
