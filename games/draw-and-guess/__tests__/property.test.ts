import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { MAX_POINTS, MAX_STROKES } from '../server/types';
import type { Input, State } from '../server/types';
import { chunk, kit, leafStrings } from './helpers';

function invariant(state: State, seed: number, step: number): void {
  const where = `seed ${seed}, event ${step}, phase ${state.phase.id}`;
  const fail = (message: string): never => {
    throw new Error(`${where}: ${message}`);
  };
  if (!game.phases.includes(state.phase.id)) fail('undeclared phase');
  if (JSON.stringify(JSON.parse(JSON.stringify(state))) !== JSON.stringify(state))
    fail('state is not JSON');
  if (Buffer.byteLength(JSON.stringify(state)) > 256 * 1024) fail('state exceeds 256 KiB');
  if (state.strokes.length > MAX_STROKES) fail('stroke chunk cap exceeded');
  if (state.strokes.reduce((count, stroke) => count + stroke.points.length, 0) > MAX_POINTS)
    fail('point cap exceeded');
  if (Object.values(state.scores).some((score) => !Number.isFinite(score) || score < 0))
    fail('invalid score');
  const chunks = state.strokes.map((stroke) => stroke.seq);
  if (chunks.some((seq, i) => i > 0 && seq <= chunks[i - 1]!))
    fail('non-increasing accepted packet sequence');
  for (const history of Object.values(state.guesses))
    if (new Set(history).size !== history.length || history.length > 80)
      fail('invalid private guess history');
  const publicViews = [
    game.tvView(state),
    ...Object.keys(state.players)
      .filter((id) => id !== state.drawerId)
      .map((id) => game.controllerView(state, id)),
    game.controllerView(state, '__proto__'),
  ];
  for (const view of publicViews) {
    if (Buffer.byteLength(JSON.stringify(view)) > 64 * 1024) fail('view exceeds 64 KiB');
    if (['choose', 'draw'].includes(state.phase.id)) {
      const leaves = leafStrings(view);
      for (const secret of [state.word?.text, ...state.choices.map((word) => word.text)])
        if (secret !== undefined && leaves.includes(secret)) fail(`public view leaks ${secret}`);
    }
  }
}

function exercise(seed: number): void {
  const rng = createRng(seed);
  let state = kit.start({
    seed,
    players: testPlayers(rng.pick([2, 4, 8])),
    settings: {
      rounds: rng.pick([1, 2]),
      seconds: rng.pick([45, 60, 75]),
      difficulty: rng.pick(['easy', 'medium', 'hard', 'mixed']),
    },
  });
  let replayed = structuredClone(state);
  let now = state.phase.startedAt;
  for (let step = 0; step < 40; step++) {
    invariant(state, seed, step);
    now += rng.int(1, 3000);
    const ids = Object.keys(state.players);
    const id = rng.pick([...ids, 'spectator', '__proto__']);
    let event: GameEvent<Input>;
    switch (rng.int(0, 9)) {
      case 0:
        event = {
          type: 'input',
          now,
          playerId: state.drawerId,
          input: { type: 'choose', index: rng.int(0, 2) },
        };
        break;
      case 1:
        event = {
          type: 'input',
          now,
          playerId: id,
          input: { type: 'guess', text: state.word?.text ?? 'a guess' },
        };
        break;
      case 2:
        event = {
          type: 'input',
          now,
          playerId: id,
          input: chunk(state.lastSeq + 1, state.lastStroke + 1),
        };
        break;
      case 3:
        event = {
          type: 'input',
          now,
          playerId: id,
          input: { type: rng.chance(0.5) ? 'undo' : 'clear' },
        };
        break;
      case 4:
        event = { type: 'player', now, playerId: id, connected: rng.chance(0.7) };
        break;
      case 5:
        event = { type: 'vip', now, action: rng.pick(['pause', 'resume', 'skip']) };
        break;
      case 6:
        event = {
          type: 'timer',
          now,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt - 1,
        };
        break;
      case 7:
        event = { type: 'speech', now, key: 'unrequested-reading', ms: 1000 };
        break;
      default:
        now = Math.max(now, state.phase.deadline ?? now);
        event = { type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt };
        break;
    }
    const before = JSON.stringify(state);
    const prior = state;
    state = game.reduce(state, event);
    replayed = game.reduce(replayed, structuredClone(event));
    if (JSON.stringify(prior) !== before)
      throw new Error(`seed ${seed}, event ${step}: mutated source`);
    if (JSON.stringify(state) !== JSON.stringify(replayed))
      throw new Error(`seed ${seed}, event ${step}: nondeterministic replay`);
  }
  invariant(state, seed, 40);
  const end = kit.vip(state, 'end', now + 1000);
  if (end.phase.id !== 'done' || game.results(end) === null)
    throw new Error(`seed ${seed}: VIP end failed`);
  const results = game.results(end)!;
  if (Object.keys(results.scores).sort().join(',') !== Object.keys(state.players).sort().join(','))
    throw new Error(`seed ${seed}: lost a result seat`);
}

describe('seeded reducer properties', () => {
  it.each([1, 2, 3])(
    'preserves invariants and deterministic replay for regression seed %i',
    exercise,
  );

  it('preserves invariants for 1000 reproducible randomly selected seeds', () => {
    const rng = createRng(0x5eed04);
    const seeds = new Set<number>();
    while (seeds.size < 1000) seeds.add(rng.int(4, 0x7fffffff));
    for (const seed of seeds) exercise(seed);
    expect(seeds.size).toBe(1000);
    if (process.env['PB_RECORD_VERIFY'] === '1')
      writeFileSync(
        resolve('jobs/P04-draw-and-guess/tools/property-results.json'),
        JSON.stringify(
          {
            passed: true,
            regressionSeeds: [1, 2, 3],
            randomSeedGenerator: '0x5eed04',
            randomSeeds: [...seeds],
            eventsPerSeed: 40,
            properties: [
              'JSON bounds',
              'stroke and guess caps',
              'score finiteness',
              'view privacy',
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
    console.log(
      'Property cases: regression seeds 1,2,3 + 1000 unique seeds from PRNG 0x5eed04; 40 events each.',
    );
  }, 120_000);
});
