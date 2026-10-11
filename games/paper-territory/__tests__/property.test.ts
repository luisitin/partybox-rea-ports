import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';

type State = ReturnType<typeof game.init>;
type Input = NonNullable<ReturnType<typeof game.bot.sampleInput>>;

function hasNonFiniteNumber(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (Array.isArray(value)) {
    for (const child of value) if (hasNonFiniteNumber(child)) return true;
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) if (hasNonFiniteNumber(child)) return true;
  }
  return false;
}

function invariant(state: State, seed: number, step: number): void {
  const fail = (message: string): never => {
    throw new Error(`seed=${seed}, event=${step}, phase=${state.phase.id}: ${message}`);
  };
  if (!game.phases.includes(state.phase.id)) fail('undeclared phase');
  const json = JSON.stringify(state);
  if (JSON.stringify(JSON.parse(json)) !== json) fail('not JSON serializable');
  if (Buffer.byteLength(json) > 256 * 1024) fail('state exceeds 256 KiB');
  if (hasNonFiniteNumber(state)) fail('nonfinite state number');
  const world = state.world;
  if (
    world.owners.length !== world.width * world.height ||
    world.homes.length !== world.owners.length
  )
    fail('incorrect grid lengths');
  const slots = new Set(world.runners.map((r) => r.slot));
  if (slots.size !== world.runners.length) fail('duplicate seat slot');
  for (let at = 0; at < world.owners.length; at++) {
    if (world.owners[at] !== -1 && !slots.has(world.owners[at]!)) fail('invalid territory owner');
    if (world.homes[at]! >= 0 && world.owners[at] !== world.homes[at])
      fail('protected home was stolen');
  }
  for (const runner of world.runners) {
    if (runner.cell < 0 || runner.cell >= world.owners.length) fail('head outside board');
    if (runner.trail.some((at) => at < 0 || at >= world.owners.length)) fail('trail outside board');
    if (new Set(runner.trail).size !== runner.trail.length) fail('duplicate vulnerable trail cell');
    if (runner.area !== world.owners.filter((owner) => owner === runner.slot).length)
      fail('area differs from owned tiles');
  }
  if (state.checked !== world.stepped * 200 || world.stepped > 600)
    fail('simulation clock mismatch');
  for (const id of [...Object.keys(state.players), 'spectator', '__proto__', '']) {
    const view = game.controllerView(state, id);
    if (view.me.id !== id) fail('wrong controller identity');
    if (view.me.role !== (Object.hasOwn(state.players, id) ? 'player' : 'spectator'))
      fail('prototype/spectator role confusion');
    if (Buffer.byteLength(JSON.stringify(view)) > 64 * 1024) fail('controller view exceeds 64 KiB');
  }
  if (Buffer.byteLength(JSON.stringify(game.tvView(state))) > 64 * 1024)
    fail('TV view exceeds 64 KiB');
}

function exercise(seed: number): void {
  const rng = createRng(seed);
  const kit = testKit(game, { t0: 1_000_000, players: testPlayers(rng.pick([2, 4, 8])) });
  let state = kit.start({ seed, settings: { rounds: rng.pick([1, 2]) } });
  let replay = structuredClone(state);
  let now = state.phase.startedAt;
  for (let step = 0; step < 40; step++) {
    invariant(state, seed, step);
    now += rng.int(1, 3000);
    const ids = Object.keys(state.players);
    const id = rng.pick([...ids, 'spectator', '__proto__']);
    let event: GameEvent<Input>;
    const sample = game.bot.sampleInput(state, rng.pick(ids), rng);
    switch (rng.int(0, 8)) {
      case 0:
      case 1:
        event =
          sample === null
            ? { type: 'speech', now, key: 'unrequested', ms: 1000 }
            : { type: 'input', now, playerId: id, input: sample };
        break;
      case 2:
        event = { type: 'player', now, playerId: id, connected: rng.chance(0.6) };
        break;
      case 3:
        event = { type: 'vip', now, action: rng.pick(['pause', 'resume', 'skip']) };
        break;
      case 4:
        event = {
          type: 'timer',
          now,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt - 1,
        };
        break;
      case 5:
        event = { type: 'speechStart', now, key: 'unrequested' };
        break;
      default:
        now = Math.max(now, state.phase.deadline ?? now);
        event = { type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt };
        break;
    }
    const before = JSON.stringify(state);
    const prior = state;
    state = game.reduce(state, event);
    replay = game.reduce(replay, structuredClone(event));
    if (JSON.stringify(prior) !== before)
      throw new Error(`seed=${seed}, event=${step}: source mutated`);
    if (JSON.stringify(state) !== JSON.stringify(replay))
      throw new Error(`seed=${seed}, event=${step}: replay diverged`);
  }
  invariant(state, seed, 40);
  const end = kit.vip(state, 'end', now + 1000);
  if (end.phase.id !== 'done' || game.results(end) === null)
    throw new Error(`seed=${seed}: end failed`);
  const results = game.results(end)!;
  if (Object.keys(results.scores).sort().join(',') !== Object.keys(state.players).sort().join(','))
    throw new Error(`seed=${seed}: lost result seat`);
  if (Object.values(results.scores).some((score) => !Number.isFinite(score)))
    throw new Error(`seed=${seed}: invalid result score`);
}

describe('1003 seeded property traces', () => {
  it.each([1, 2, 3])('preserves invariants for regression seed %i', exercise);
  it('preserves invariants and replay for 1000 reproducibly random seeds', () => {
    const rng = createRng(0x5eed07);
    const seeds = new Set<number>();
    while (seeds.size < 1000) seeds.add(rng.int(4, 0x7fffffff));
    for (const seed of seeds) exercise(seed);
    expect(seeds.size).toBe(1000);
    if (process.env['PB_RECORD_VERIFY'] === '1') {
      const dir = resolve('jobs/P07-paper-territory/tools');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        resolve(dir, 'property-results.json'),
        JSON.stringify(
          {
            passed: true,
            regressionSeeds: [1, 2, 3],
            randomSeedGenerator: '0x5eed07',
            randomSeeds: [...seeds],
            eventsPerSeed: 40,
            properties: [
              'JSON bounds',
              'finite numbers',
              'view bounds',
              'spectator identity',
              'source immutability',
              'deterministic replay',
              'complete results',
            ],
          },
          null,
          2,
        ) + '\n',
        'utf8',
      );
    }
  }, 180_000);
});
