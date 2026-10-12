import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@partybox/game-sdk';
import { game } from '../server/index';
import type { Input, State } from '../server/types';
import { copy, deepFreeze, finishIdle, input, start, T0 } from './helpers';

// Reproducible samples, rather than Math.random or an implicit test-run seed.
const sampled: number[] = [];
let sample = 0x483be971;
for (let i = 0; i < 1000; i++) {
  sample = (Math.imul(sample, 1664525) + 1013904223) >>> 0;
  sampled.push(sample);
}
export const PROPERTY_SEEDS = [1, 2, 3, ...sampled];

function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value;
  };
}
function views(state: State, label: string): void {
  const tv = game.tvView(state);
  expect(copy(tv), label).toEqual(tv);
  expect(JSON.stringify(tv), label).not.toContain('"intents"');
  for (const id of [...Object.keys(state.players), 'spectator', '__proto__']) {
    const cv = game.controllerView(state, id);
    expect(copy(cv), label).toEqual(cv);
    expect(cv.ball, label).toEqual(tv.ball);
    expect(cv.discs, label).toEqual(tv.discs);
    expect(cv.me.role, label).toBe(Object.hasOwn(state.players, id) ? 'player' : 'spectator');
    expect(JSON.stringify(cv), label).not.toContain('"intents"');
    expect(JSON.stringify(cv), label).not.toContain('"until"');
  }
}

describe('seeded replay, totality and public-view properties', () => {
  it('deep-freezes/replays seeds1,2,3 plus1000 sampled seeds with every roster count and lifecycle events', () => {
    expect(PROPERTY_SEEDS).toHaveLength(1003);
    expect(new Set(sampled).size).toBe(1000);
    for (let n = 0; n < PROPERTY_SEEDS.length; n++) {
      const seed = PROPERTY_SEEDS[n]!;
      const next = random(seed);
      const count = 2 + (n % 7);
      const original = start(count, seed, 30, n % 2 === 0);
      let state = original;
      const events: GameEvent<Input>[] = [];
      const states: string[] = [];
      const label = `seed=${seed}, players=${count}`;
      for (let i = 0; i < 32; i++) {
        const now = state.clock + 50 + (next() % 400);
        const id = `p${1 + (next() % count)}`;
        let event: GameEvent<Input>;
        if (i === 6) event = { type: 'vip', now, action: 'pause' };
        else if (i === 8) event = { type: 'vip', now, action: 'resume' };
        else if (i === 15 || i === 17)
          event = { type: 'player', now, playerId: 'p1', connected: i === 17 };
        else if (i === 25)
          event = { type: 'player', now, playerId: `p${count}`, connected: false, gone: 'left' };
        else if (i % 7 === 0) event = { type: 'timer', now, phaseId: 'play', startedAt: T0 - 1 };
        else if (i % 5 === 0)
          event = { type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt };
        else
          event = {
            type: 'input',
            now,
            playerId: i % 11 === 0 ? '__proto__' : id,
            input: input(state, id, {
              dx: ((next() % 3) - 1) as -1 | 0 | 1,
              dy: ((next() % 3) - 1) as -1 | 0 | 1,
              kick: next() % 2 === 0,
              ...(i % 4 === 0 ? { phaseAt: T0 - 1 } : {}),
            }),
          };
        const before = JSON.stringify(state);
        const frozen = deepFreeze(state);
        state = game.reduce(frozen, event);
        expect(JSON.stringify(frozen), label).toBe(before);
        expect(copy(state), label).toEqual(state);
        expect(JSON.stringify(state).length, label).toBeLessThan(256 * 1024);
        for (const item of [...state.discs, state.ball])
          expect([item.x, item.y, item.vx, item.vy].every(Number.isFinite), label).toBe(true);
        expect(
          Object.values(state.goals).every((goals) => Number.isInteger(goals) && goals >= 0),
          label,
        ).toBe(true);
        if (i % 8 === 0) views(deepFreeze(state), label);
        events.push(event);
        states.push(JSON.stringify(state));
      }
      let replay = game.init({
        players: Object.values(original.players),
        settings: { halfSeconds: 30 },
        seed,
        now: T0,
        presence: { mode: 'together', phoneOnly: n % 2 === 0 },
      });
      expect(replay, label).toEqual(original);
      for (let i = 0; i < events.length; i++) {
        replay = game.reduce(deepFreeze(replay), events[i]!);
        expect(JSON.stringify(replay), `${label}, event=${i}`).toBe(states[i]);
      }
      const finished = finishIdle(state);
      expect(JSON.stringify(finishIdle(replay)), label).toBe(JSON.stringify(finished));
      expect(finished.clock - T0, label).toBeLessThan(game.manifest.estimatedMinutes * 2 * 60_000);
      const result = game.results(finished)!;
      expect(Object.keys(result.scores).sort(), label).toEqual(
        Object.keys(original.players).sort(),
      );
      expect(Object.values(result.scores).every(Number.isFinite), label).toBe(true);
      views(finished, label);
    }
  }, 180_000);
});
