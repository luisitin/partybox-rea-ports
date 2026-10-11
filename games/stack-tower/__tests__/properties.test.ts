import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { GameEvent } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State, Tower } from '../server/types';
import { ROUND_MS } from '../server/types';
import {
  axisOf,
  drop,
  KEEP_BLOCKS,
  makeTower,
  MAX_HEIGHT,
  MIN_WIDTH,
  WIDTH,
} from '../server/world';
import type { Input } from '../server/world';
import { kit, T0, timeAtOffset } from './helpers';

// These are sampled, distinct game/property seeds rather than the consecutive integers 1..1000.
// Recreate this corpus with the same fast-check seed if a later implementation regresses.
const CORPUS_SEED = 0x1651011;
const corpus = fc.sample(
  fc.uniqueArray(fc.integer({ min: 4, max: 0x7fffffff }), { minLength: 1000, maxLength: 1000 }),
  { seed: CORPUS_SEED, numRuns: 1 },
)[0] as number[];

const geometry = fc.record({
  height: fc.integer({ min: 0, max: MAX_HEIGHT - 1 }),
  w: fc.integer({ min: MIN_WIDTH * 1000, max: WIDTH * 1000 }),
  d: fc.integer({ min: MIN_WIDTH * 1000, max: WIDTH * 1000 }),
  x: fc.integer({ min: -40_000, max: 40_000 }),
  z: fc.integer({ min: -40_000, max: 40_000 }),
  streak: fc.integer({ min: 0, max: 8 }),
  bestExtra: fc.integer({ min: 0, max: 8 }),
  offset: fc.integer({ min: -95_000, max: 95_000 }),
  course: fc.integer({ min: 0, max: 1 }),
});

const actions = fc.array(
  fc.record({
    delta: fc.integer({ min: 0, max: 1800 }),
    seat: fc.integer({ min: 0, max: 7 }),
    action: fc.constantFrom(
      'drop',
      'retry',
      'timer',
      'disconnect',
      'reconnect',
      'pause',
      'resume',
      'stale',
      'ghost',
    ),
  }),
  { minLength: 15, maxLength: 35 },
);

function checkBounds(state: State, previous?: State): void {
  const require = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  require(state.endsAt - state.began === ROUND_MS, 'Pause changed the playable 45-second budget');
  require(game.phases.includes(state.phase.id), `Undeclared phase ${state.phase.id}`);
  for (const tower of state.towers) {
    require(tower.height >= 0 && tower.height <= MAX_HEIGHT, `${tower.id}: invalid height`);
    require(tower.best >= tower.height && tower.best <= MAX_HEIGHT, `${tower.id}: invalid best`);
    require(tower.footprint.w >= MIN_WIDTH &&
      tower.footprint.w <= WIDTH, `${tower.id}: invalid width`);
    require(tower.footprint.d >= MIN_WIDTH &&
      tower.footprint.d <= WIDTH, `${tower.id}: invalid depth`);
    require(Number.isFinite(tower.footprint.x) &&
      Number.isFinite(tower.footprint.z), `${tower.id}: nonfinite center`);
    require(tower.blocks.length <= KEEP_BLOCKS &&
      tower.bestBlocks.length <= KEEP_BLOCKS, `${tower.id}: unbounded history`);
    require(state.scores[tower.id] === tower.best, `${tower.id}: score disagrees with best tower`);
    if (previous)
      require(tower.best >= (previous.scores[tower.id] ?? 0), `${tower.id}: lost a best score`);
  }
}

const rules = (seed: number) =>
  fc.property(geometry, actions, (sample, trace) => {
    const footprint = {
      x: sample.x / 1000,
      z: sample.z / 1000,
      w: sample.w / 1000,
      d: sample.d / 1000,
    };
    const tower: Tower = {
      ...makeTower('a', T0),
      footprint,
      blocks: [footprint],
      bestBlocks: [footprint],
      height: sample.height,
      best: Math.min(MAX_HEIGHT, sample.height + sample.bestExtra),
      streak: sample.streak,
    };
    const before = JSON.stringify(tower);
    const now = timeAtOffset(tower, sample.offset / 1000, sample.course);
    const after = drop(tower, now, sample.course);
    expect(JSON.stringify(tower)).toBe(before);
    expect(drop(tower, now, sample.course)).toEqual(after);
    expect(after.best).toBeGreaterThanOrEqual(tower.best);
    expect(after.height).toBe(tower.height + (after.crashedAt === null ? 1 : 0));
    const active = axisOf(tower.height);
    const inactiveSize = active === 'x' ? 'd' : 'w';
    const inactiveCenter = active === 'x' ? 'z' : 'x';
    expect(after.footprint[inactiveSize]).toBe(tower.footprint[inactiveSize]);
    expect(after.footprint[inactiveCenter]).toBe(tower.footprint[inactiveCenter]);
    for (const size of [after.footprint.w, after.footprint.d]) {
      expect(size).toBeGreaterThanOrEqual(MIN_WIDTH);
      expect(size).toBeLessThanOrEqual(WIDTH);
    }

    const players = testPlayers([2, 4, 8][seed % 3] as number);
    let state = kit.start({ players, seed });
    let replay = kit.start({ players, seed });
    let clock = T0;
    for (const step of trace) {
      clock += step.delta;
      const actor = state.towers[step.seat % state.towers.length] as Tower;
      let event: GameEvent<Input>;
      switch (step.action) {
        case 'drop':
        case 'ghost':
          event = {
            type: 'input',
            now: clock,
            playerId: step.action === 'ghost' ? '__proto__' : actor.id,
            input: { type: 'drop', attempt: actor.attempt, level: actor.height },
          };
          break;
        case 'retry':
          event = {
            type: 'input',
            now: clock,
            playerId: actor.id,
            input: { type: 'restart', attempt: actor.attempt },
          };
          break;
        case 'disconnect':
        case 'reconnect':
          event = {
            type: 'player',
            now: clock,
            playerId: actor.id,
            connected: step.action === 'reconnect',
          };
          break;
        case 'pause':
        case 'resume':
          event = { type: 'vip', now: clock, action: step.action };
          break;
        default:
          event = {
            type: 'timer',
            now: clock,
            phaseId: state.phase.id,
            startedAt: state.phase.startedAt - (step.action === 'stale' ? 1 : 0),
          };
      }
      const immutable = JSON.stringify(state);
      const next = kit.reduce(state, event);
      expect(JSON.stringify(state)).toBe(immutable);
      replay = kit.reduce(replay, event);
      expect(JSON.stringify(next)).toBe(JSON.stringify(replay));
      checkBounds(next, state);
      if (state.phase.paused && (event.type === 'input' || event.type === 'timer'))
        expect(next).toEqual(state);
      state = next;
    }
    state = kit.vip(state, 'resume', clock);
    if (state.phase.id === 'play') state = kit.timer(state, state.endsAt);
    if (state.phase.id === 'score') state = kit.timer(state, state.phase.deadline!);
    expect(state.phase.id).toBe('done');
    checkBounds(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(Object.keys(game.results(state)!.scores).sort()).toEqual(
      players.map((player) => player.id).sort(),
    );
    expect(game.results(state)!.winnerIds.length).toBeGreaterThan(0);
  });

describe('seeded properties', () => {
  it.each([1, 2, 3])(
    'geometry, immutable replay and mixed connectivity/VIP traces for fixed seed %i',
    (seed) => {
      fc.assert(rules(seed), { seed, numRuns: 80, endOnFailure: true });
    },
  );

  it('checks the same properties against 1,000 sampled seeds (corpus seed 0x1651011)', () => {
    expect(corpus).toHaveLength(1000);
    expect(new Set(corpus).size).toBe(1000);
    expect(corpus.some((seed, index) => seed === index + 1)).toBe(false);
    for (const seed of corpus) fc.assert(rules(seed), { seed, numRuns: 1, endOnFailure: true });
  });
});
