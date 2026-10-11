import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { H, W } from '../server/types';
import type { Input, State } from '../server/types';

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label);
}

export function assertState(state: State, label: string): void {
  const json = JSON.stringify(state);
  assert(json === JSON.stringify(JSON.parse(json)), `${label}: JSON round-trip`);
  assert(Buffer.byteLength(json) <= 256 * 1024, `${label}: state size`);
  assert(game.phases.includes(state.phase.id as (typeof game.phases)[number]), `${label}: phase`);
  assert(state.world.platforms.length === 261, `${label}: course size`);
  for (const c of state.world.climbers) {
    for (const n of [c.x, c.y, c.vy, c.peak, c.camera, c.bounces])
      assert(Number.isFinite(n), `${label}: finite climber`);
    assert(c.x >= 0 && c.x < W, `${label}: wrap range`);
    assert(c.peak >= 0 && c.camera >= 0, `${label}: nonnegative height`);
    assert(c.peak >= c.y, `${label}: peak monotonic bound`);
    assert([-1, 0, 1].includes(c.dir), `${label}: steering range`);
    assert(c.died === null || c.died >= 0, `${label}: death time`);
  }
  for (const score of Object.values(state.scores))
    assert(Number.isFinite(score) && score >= 0 && Number.isInteger(score), `${label}: score`);
  const views = [
    game.tvView(state),
    ...[...Object.keys(state.players), 'spectator', '__proto__'].map((id) =>
      game.controllerView(state, id),
    ),
  ];
  for (const view of views) {
    const serialized = JSON.stringify(view);
    assert(Buffer.byteLength(serialized) <= 64 * 1024, `${label}: view size`);
    assert(serialized === JSON.stringify(JSON.parse(serialized)), `${label}: JSON view`);
    assert(
      !serialized.includes('"rng"') && !serialized.includes('"world"'),
      `${label}: private keys`,
    );
    for (const p of view.platforms)
      assert(
        state.world.climbers.some((c) => p.y >= c.camera - 24 && p.y <= c.camera + H),
        `${label}: future platform`,
      );
  }
}

export const PROPERTY_SEEDS = [
  1,
  2,
  3,
  ...createRng(0x15d00d1e).shuffle(Array.from({ length: 1000 }, (_, i) => i + 4)),
];

/** Each seeded schedule mixes valid controls and awkward engine events against frozen state. */
export function propertyRun(seed: number): number {
  const rng = createRng(seed);
  const init = deepFreeze({
    players: testPlayers(2 + (seed % 7)),
    settings: { rounds: 3, seconds: 30 },
    seed,
    now: 1000,
  });
  let state = game.init(init);
  let replay = game.init(init);
  let now = init.now;
  const bag = rng.shuffle([
    'input',
    'input',
    'input',
    'timer',
    'timer',
    'player',
    'pause',
    'resume',
    'skip',
    'stale',
    'speech',
    'speechStart',
  ]);
  let events = 0;
  for (let step = 0; step < 36; step++) {
    const action = bag[step % bag.length]!;
    now += rng.int(0, 500);
    const id = rng.pick([...Object.keys(state.players), 'spectator', '__proto__']);
    let event: GameEvent<Input>;
    switch (action) {
      case 'input':
        event = {
          type: 'input',
          now,
          playerId: id,
          input: { type: 'steer', dir: rng.pick([-1, 0, 1] as const) },
        };
        break;
      case 'timer':
        now = Math.max(now, state.phase.deadline ?? now);
        event = { type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt };
        break;
      case 'stale':
        event = {
          type: 'timer',
          now,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt - 1,
        };
        break;
      case 'player':
        event = { type: 'player', now, playerId: id, connected: rng.int(0, 1) === 1 };
        break;
      case 'speech':
        event = { type: 'speech', now, key: 'unrequested', ms: -1 };
        break;
      case 'speechStart':
        event = { type: 'speechStart', now, key: 'unrequested' };
        break;
      default:
        event = { type: 'vip', now, action: action as 'pause' | 'resume' | 'skip' };
    }
    const before = JSON.stringify(state);
    deepFreeze(state);
    deepFreeze(replay);
    deepFreeze(event);
    const next = game.reduce(state, event);
    replay = game.reduce(replay, event);
    assert(JSON.stringify(state) === before, `seed ${seed}/${step}: mutation`);
    assert(
      JSON.stringify(next) === JSON.stringify(replay),
      `seed ${seed}/${step}: replay divergence`,
    );
    state = next;
    if (step % 6 === 0 || step === 35) assertState(state, `seed ${seed}/${step}`);
    events++;
  }
  state = game.reduce(deepFreeze(state), deepFreeze({ type: 'vip', now, action: 'end' }));
  assert(
    game.results(state)?.ranking.length === init.players.length,
    `seed ${seed}: result completeness`,
  );
  return events + 1;
}
