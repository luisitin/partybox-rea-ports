import { describe, expect, it } from 'vitest';
import { seedRng } from '@partybox/game-sdk';
import { gateColour, makeWorld, tap, tick } from '../server/world';
import { roundPoints } from '../server/scoring';
import type { Gate, Runner, World } from '../server/types';
import { GAP, GRAVITY, IMPULSE, RETRY_MS, STEP_MS, TAP_MS } from '../server/types';

function runner(extra: Partial<Runner> = {}): Runner {
  return {
    id: 'a',
    y: 0,
    velocity: 0,
    gates: 0,
    colour: 0,
    floor: 0,
    lastTap: -1000,
    respawnAt: null,
    crashes: 0,
    bestHeight: 0,
    launched: false,
    ...extra,
  };
}
const gate = (extra: Partial<Gate> = {}): Gate => ({
  height: 120,
  offset: 0,
  beatMs: 800,
  direction: 1,
  colourAfter: 2,
  ...extra,
});
const world = (r: Runner = runner(), gates: Gate[] = [gate()]): World => ({
  runners: [r],
  gates,
  checked: 0,
});

describe('the fair rotating course', () => {
  it('turns on exact beat boundaries and wraps reverse rotation without negative colours', () => {
    expect([0, 799, 800, 1599, 1600, 3199, 3200].map((t) => gateColour(gate(), t))).toEqual([
      0, 0, 1, 1, 2, 3, 0,
    ]);
    expect(
      [0, 1, 799, 800, 801, 1600, 3200].map((t) => gateColour(gate({ direction: -1 }), t)),
    ).toEqual([0, 3, 3, 3, 2, 2, 0]);
    expect(gateColour(gate({ offset: 3 }), 800)).toBe(0);
  });

  it('is seeded, shared by every lane, spaced by 120 and advances only its RNG state', () => {
    const rng = seedRng(11);
    const before = JSON.stringify(rng);
    const [a, after] = makeWorld(rng, ['a', 'b', 'c']);
    const [b, again] = makeWorld(seedRng(11), ['a', 'b', 'c']);
    const [other] = makeWorld(seedRng(12), ['a', 'b', 'c']);
    expect(a).toEqual(b);
    expect(after).toEqual(again);
    expect(JSON.stringify(rng)).toBe(before);
    expect(after.step).toBeGreaterThan(rng.step);
    expect(a.gates).not.toEqual(other.gates);
    expect(a.gates.length).toBeGreaterThanOrEqual(60);
    a.gates.forEach((g, i) => {
      expect(g.height).toBe((i + 1) * GAP);
      expect([0, 1, 2, 3]).toContain(g.offset);
      expect([0, 1, 2, 3]).toContain(g.colourAfter);
      expect([-1, 1]).toContain(g.direction);
      expect(g.beatMs).toBeGreaterThanOrEqual(600);
      expect(g.beatMs).toBeLessThanOrEqual(950);
    });
    expect(new Set(a.runners.map((r) => r.colour)).size).toBe(1);
    expect(a.runners.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    for (const r of a.runners) {
      expect(r.y).toBe(0);
      expect(r.floor).toBe(0);
      expect(r.velocity).toBe(0);
      expect(r.gates).toBe(0);
      expect(r.launched).toBe(false);
    }
  });
});

describe('tap, climb, crash and checkpoint', () => {
  it('pins the tuned half-second bounce, debounce and retry timing', () => {
    expect(IMPULSE).toBe(105);
    expect(GRAVITY).toBe(420);
    expect((2 * IMPULSE) / GRAVITY).toBe(0.5);
    expect(TAP_MS).toBe(140);
    expect(RETRY_MS).toBe(1200);
    expect(STEP_MS).toBe(20);
    expect(GAP).toBe(120);
  });
  it('keeps waiting runners safely on their checkpoint until a tap', () => {
    const w = world(runner({ floor: 270, y: 270, gates: 3 }));
    const idle = tick(w, 3000).runners[0]!;
    expect(idle.y).toBe(270);
    expect(idle.velocity).toBe(0);
    expect(idle.crashes).toBe(0);
    const launched = tap(w, 'a', 0).runners[0]!;
    expect(launched.velocity).toBe(IMPULSE);
    expect(launched.launched).toBe(true);
  });

  it('sets rather than adds impulse; rate-limits duplicate taps but accepts the 140 ms boundary', () => {
    const once = tap(world(), 'a', 0);
    expect(once.runners[0]!.velocity).toBe(IMPULSE);
    expect(tap(once, 'a', 0)).toBe(once);
    expect(tap(once, 'a', TAP_MS - 1)).toBe(once);
    const twice = tap(once, 'a', TAP_MS);
    expect(twice.runners[0]!.lastTap).toBe(TAP_MS);
    expect(twice.runners[0]!.velocity).toBe(IMPULSE);
    expect(tap(once, 'missing', 200)).toBe(once);
  });

  it('uses gravity and a 20 ms sample grid with no drift across arbitrary timer partitions', () => {
    const w = tap(world(), 'a', 0);
    const first = tick(w, STEP_MS).runners[0]!;
    expect(first.velocity).toBeCloseTo(IMPULSE - GRAVITY * 0.02, 6);
    expect(first.y).toBeCloseTo(IMPULSE * 0.02 - 0.5 * GRAVITY * 0.02 ** 2, 6);
    const full = tick(w, 620);
    const split = tick(tick(tick(tick(w, 83), 199), 427), 620);
    expect(split).toEqual(full);
    expect(full.checked).toBe(620);
    expect(tick(full, 620)).toBe(full);
    expect(tick(full, 400)).toBe(full);
  });

  it('passes only a matching upward crossing, adopts the next colour and lifts its checkpoint', () => {
    const w = world(runner({ y: 119, velocity: 190, launched: true, bestHeight: 119 }));
    const passed = tick(w, 20).runners[0]!;
    expect(passed.gates).toBe(1);
    expect(passed.colour).toBe(2);
    expect(passed.floor).toBe(30);
    expect(passed.crashes).toBe(0);
    expect(passed.bestHeight).toBeGreaterThanOrEqual(120);
    const descending = tick(
      world(runner({ y: 121, velocity: -190, launched: true, bestHeight: 121 })),
      20,
    );
    expect(descending.runners[0]!.gates).toBe(0);
  });

  it('samples the gate at the crossing time, stops on a wrong colour and retains prior best height', () => {
    const w = world(runner({ y: 119, velocity: 190, colour: 1, launched: true, bestHeight: 119 }));
    const crashed = tick(w, 20).runners[0]!;
    expect(crashed.gates).toBe(0);
    expect(crashed.crashes).toBe(1);
    expect(crashed.respawnAt).toBe(20 + RETRY_MS);
    expect(crashed.bestHeight).toBeGreaterThanOrEqual(119);
    expect(crashed.bestHeight).toBeLessThan(120);
    const boundary: World = { ...w, checked: 780, runners: [{ ...w.runners[0]!, colour: 1 }] };
    expect(tick(boundary, 800).runners[0]!.gates).toBe(1);
  });

  it('blocks controls during retry, resets at 1200 ms and keeps cleared gates and checkpoint', () => {
    const crashed = world(
      runner({
        gates: 2,
        floor: 150,
        y: 200,
        bestHeight: 240,
        colour: 3,
        launched: true,
        respawnAt: 1200,
        crashes: 1,
      }),
    );
    expect(tap(crashed, 'a', 1199)).toBe(crashed);
    const waiting = tick(crashed, 1180).runners[0]!;
    expect(waiting.respawnAt).toBe(1200);
    const retry = tick(crashed, 1200).runners[0]!;
    expect(retry.respawnAt).toBeNull();
    expect(retry.y).toBe(150);
    expect(retry.velocity).toBe(0);
    expect(retry.launched).toBe(false);
    expect(retry.gates).toBe(2);
    expect(retry.bestHeight).toBe(240);
    expect(retry.colour).toBe(3);
  });

  it('crashes once on falling below the safe floor and never taxes progress or a second lane', () => {
    const w: World = {
      ...world(
        runner({ y: 150.1, floor: 150, gates: 2, velocity: -50, launched: true, bestHeight: 245 }),
      ),
      runners: [
        runner({ y: 150.1, floor: 150, gates: 2, velocity: -50, launched: true, bestHeight: 245 }),
        runner({ id: 'b' }),
      ],
    };
    const crash = tick(w, 200);
    expect(crash.runners[0]!.crashes).toBe(1);
    expect(crash.runners[0]!.gates).toBe(2);
    expect(crash.runners[0]!.bestHeight).toBe(245);
    expect(crash.runners[1]!.crashes).toBe(0);
    expect(crash.runners[1]!.y).toBe(0);
  });

  it('never mutates an old world while moving, tapping, crashing or respawning', () => {
    const w = world(runner({ y: 119, launched: true, velocity: 190, colour: 3, bestHeight: 119 }));
    const before = JSON.stringify(w);
    tick(w, 2000);
    tap(w, 'a', 1000);
    expect(JSON.stringify(w)).toBe(before);
  });
});

describe('farthest fair score', () => {
  it('awards 100 per gate and floors partial height, capping each uncrossed gate at 99', () => {
    const w: World = {
      checked: 0,
      gates: [],
      runners: [
        runner({ id: 'a', gates: 0, bestHeight: 60 }),
        runner({ id: 'b', gates: 1, bestHeight: 180 }),
        runner({ id: 'c', gates: 2, bestHeight: 245.9 }),
        runner({ id: 'd', gates: 1, bestHeight: 900 }),
        runner({ id: 'e', gates: 2, bestHeight: 100 }),
      ],
    };
    expect(roundPoints(w)).toEqual({ a: 50, b: 150, c: 204, d: 199, e: 200 });
  });

  it('keeps scores after a crash and makes every extra gate strictly better than a partial climb', () => {
    const w = world(runner({ gates: 2, bestHeight: 299.9, crashes: 10, respawnAt: 9000 }));
    expect(roundPoints(w)).toEqual({ a: 249 });
    expect(roundPoints(world(runner({ gates: 1, bestHeight: 999 }))).a).toBeLessThan(
      roundPoints(world(runner({ gates: 2, bestHeight: 240 }))).a!,
    );
  });
});
