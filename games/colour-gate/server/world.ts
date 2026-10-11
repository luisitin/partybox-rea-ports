// Fixed-step flight. Input time is quantized to the last judged 20ms sample, never a device clock.
import { nextInt, z } from '@partybox/game-sdk';
import type { RngState } from '@partybox/game-sdk';
import { GAP, GRAVITY, IMPULSE, RETRY_MS, STEP_MS, TAP_MS } from './types';
import type { Gate, Runner, World } from './types';

export const inputSchema = z.object({ type: z.literal('tap') });
const mod4 = (n: number): number => ((n % 4) + 4) % 4;
export function gateColour(gate: Gate, t: number): number {
  return mod4(Math.floor(gate.offset + (gate.direction * t) / gate.beatMs));
}

export function makeWorld(rng: RngState, ids: string[]): [World, RngState] {
  let r = rng;
  let initial: number;
  [initial, r] = nextInt(r, 0, 3);
  const gates: Gate[] = [];
  for (let i = 0; i < 64; i++) {
    let offset: number, beatMs: number, direction: number, colourAfter: number;
    [offset, r] = nextInt(r, 0, 3);
    [beatMs, r] = nextInt(r, 650, 950);
    [direction, r] = nextInt(r, 0, 1);
    [colourAfter, r] = nextInt(r, 1, 3);
    const before = i === 0 ? initial : gates[i - 1]!.colourAfter;
    gates.push({
      height: (i + 1) * GAP,
      offset,
      beatMs,
      direction: direction ? 1 : -1,
      colourAfter: mod4(before + colourAfter),
    });
  }
  const runners = ids.map((id): Runner => ({
    id,
    y: 0,
    velocity: 0,
    gates: 0,
    colour: initial,
    floor: 0,
    lastTap: -TAP_MS,
    respawnAt: null,
    crashes: 0,
    bestHeight: 0,
    launched: false,
  }));
  return [{ runners, gates, checked: 0 }, r];
}

function crash(runner: Runner, t: number): Runner {
  return { ...runner, velocity: 0, respawnAt: t + RETRY_MS, crashes: runner.crashes + 1 };
}

function step(runner: Runner, gates: Gate[], t: number): Runner {
  if (runner.respawnAt !== null) {
    return t < runner.respawnAt
      ? runner
      : { ...runner, y: runner.floor, velocity: 0, launched: false, respawnAt: null };
  }
  if (!runner.launched) return runner;
  const dt = STEP_MS / 1000;
  const y = runner.y + runner.velocity * dt - (GRAVITY * dt * dt) / 2;
  const velocity = runner.velocity - GRAVITY * dt;
  const gate = gates[runner.gates];
  let next = {
    ...runner,
    y,
    velocity,
    bestHeight: Math.max(runner.bestHeight, Math.min(y, gate ? gate.height - 0.001 : y)),
  };
  if (gate && runner.y < gate.height && y >= gate.height) {
    if (gateColour(gate, t) !== runner.colour) return crash({ ...next, y: gate.height }, t);
    next = {
      ...next,
      gates: runner.gates + 1,
      colour: gate.colourAfter,
      floor: gate.height - 90,
      bestHeight: Math.max(runner.bestHeight, y),
    };
  }
  return y < next.floor ? crash({ ...next, y: next.floor }, t) : next;
}

export function tick(world: World, to: number): World {
  const end = Math.max(world.checked, Math.floor(to / STEP_MS) * STEP_MS);
  if (end <= world.checked) return world;
  let runners = world.runners;
  for (let t = world.checked + STEP_MS; t <= end; t += STEP_MS)
    runners = runners.map((runner) => step(runner, world.gates, t));
  return { ...world, runners, checked: end };
}

export function tap(world: World, id: string, t: number): World {
  const runner = world.runners.find((r) => r.id === id);
  if (!runner || runner.respawnAt !== null || t < world.checked || t - runner.lastTap < TAP_MS)
    return world;
  return {
    ...world,
    runners: world.runners.map((r) =>
      r.id === id ? { ...r, velocity: IMPULSE, lastTap: t, launched: true } : r,
    ),
  };
}
