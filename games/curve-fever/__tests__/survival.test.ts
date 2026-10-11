// A simulated party with continuous bot reactions. Pin play time, excluding ready/score delays.
import { describe, expect, it } from 'vitest';
import { createRng, seedRng } from '@partybox/game-sdk';
import { testKit } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { botInput } from '../server/bot';
import { ROUND_MS, SPAWN_SAFE_MS, makeWorld, tick } from '../server/world';
import type { World } from '../server/world';

function roundLength(players: number, seed: number): number {
  const rng = createRng(seed);
  const ids = Array.from({ length: players }, (_, i) => `p${i + 1}`);
  const kit = testKit(game, {
    t0: 1000,
    players: ids.map((id) => ({ id, name: id, avatarId: 'fox', connected: true })),
    settings: { rounds: 1 },
  });
  let state = kit.timer(kit.start({ seed }));
  const began = state.began;
  const next = ids.map(() => began + rng.int(50, 400));
  while (state.phase.id === 'play') {
    const now = Math.min(state.phase.deadline!, ...next);
    if (now === state.phase.deadline) state = kit.timer(state);
    for (let i = 0; i < ids.length && state.phase.id === 'play'; i++) {
      if (next[i]! > now) continue;
      const id = ids[i]!;
      const input = game.bot.sampleInput(state, id, rng);
      if (input) state = kit.input(state, id, input, now);
      next[i] = now + rng.int(50, 400);
    }
  }
  return state.checked;
}

describe('round survival', () => {
  it.each([4, 6, 8])(
    'keeps %i bots playing for a median of 20–60 seconds',
    (players) => {
      const lengths = Array.from({ length: 24 }, (_, i) => roundLength(players, i + 1)).sort(
        (a, b) => a - b,
      );
      const median = (lengths[11]! + lengths[12]!) / 2;
      console.log(`${players} bots: median ${median / 1000}s; rounds ${lengths.join(',')}`);
      expect(median).toBeGreaterThanOrEqual(20_000);
      expect(median).toBeLessThanOrEqual(60_000);
      expect(Math.max(...lengths)).toBeLessThanOrEqual(ROUND_MS);
    },
    60_000,
  );

  it('gives every spawn a short safe window, including at eight players', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const [world] = makeWorld(
        seedRng(seed),
        Array.from({ length: 8 }, (_, i) => `p${i}`),
      );
      expect(tick(world, SPAWN_SAFE_MS - 1).worms.every((w) => w.died === null)).toBe(true);
    }
  });

  it('keeps an active bot responding and turns before a wall, rather than wandering into it', () => {
    const world: World = {
      stepped: 0,
      worms: [{ id: 'a', segs: [[0, 145, 50, 0, 0]], gaps: [], died: null }],
    };
    expect(botInput(world, 'a', 0)?.dir).not.toBe(0);
    expect(botInput(world, 'unknown', 0)).toBeNull();
  });

  it('enables trail collisions when the grace expires and never protects from walls', () => {
    const crossing: World = {
      stepped: -1,
      safeUntil: 2000,
      worms: [
        { id: 'a', segs: [[0, 60, 50, 0, 0]], gaps: [], died: null },
        { id: 'b', segs: [[0, 100, 50, Math.PI, 0]], gaps: [], died: null },
      ],
    };
    const before = tick(crossing, 1960);
    expect(before.worms.every((w) => w.died === null)).toBe(true);
    expect(tick(before, 2000).worms.every((w) => w.died === 2000)).toBe(true);
    const wall: World = {
      ...crossing,
      worms: [{ id: 'a', segs: [[0, 159, 50, 0, 0]], gaps: [], died: null }],
    };
    expect(tick(wall, 200).worms[0]?.died).not.toBeNull();
  });
});
