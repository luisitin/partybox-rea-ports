import fc from 'fast-check';
import assert from 'node:assert/strict';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent } from '@partybox/game-sdk';
import { fuzzOnce, testPlayers } from '@partybox/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import type { Input, State } from '../server/types';
import { kit } from './helpers';

function invariant(state: State): void {
  assert.ok(game.phases.includes(state.phase.id));
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.ok(state.checked >= 0 && state.checked <= 60_000);
  assert.ok(state.wave >= 0 && state.wave <= 29);
  for (const seat of Object.values(state.seats)) {
    assert.ok(Number.isFinite(seat.score) && seat.score >= 0);
    assert.ok(seat.strokes <= 20);
    assert.equal(new Set(seat.cut).size, seat.cut.length);
    assert.ok(seat.cut.every((id) => state.fruit.some((fruit) => fruit.id === id)));
  }
  assert.doesNotMatch(JSON.stringify(game.tvView(state)), /"(?:rng|seats|cut)"/);
  for (const id of [...Object.keys(state.players), 'ghost', '__proto__']) {
    const view = game.controllerView(state, id);
    assert.equal(view.me.role, Object.hasOwn(state.players, id) ? 'player' : 'spectator');
    assert.doesNotMatch(JSON.stringify(view), /"(?:rng|seats|cut)"/);
    assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
  }
}

/** Recorded adversarial trace: late beats, swipes, drop/rejoin, a pause and final termination. */
function trace(seed: number, count: number): void {
  const rng = createRng(seed);
  const options = { players: testPlayers(count), seed };
  let state = kit.start(options);
  let replay = kit.start(options);
  const apply = (event: GameEvent<Input>): void => {
    const before = JSON.stringify(state);
    const prior = state;
    state = game.reduce(state, event);
    replay = game.reduce(replay, event);
    expect(JSON.stringify(prior)).toBe(before);
    assert.equal(JSON.stringify(state), JSON.stringify(replay));
    invariant(state);
  };
  invariant(state);
  for (let wave = 0; wave < 5; wave++) {
    const now = state.began + wave * 2000 + 1000;
    apply({ type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt });
    for (const id of Object.keys(state.players)) {
      const input = game.bot.sampleInput(state, id, rng);
      if (input) apply({ type: 'input', now, playerId: id, input });
    }
    if (wave === 1) {
      apply({ type: 'player', now, playerId: 'p1', connected: false });
      const score = state.seats.p1!.score;
      apply({
        type: 'input',
        now,
        playerId: 'p1',
        input: {
          type: 'slice',
          wave: state.wave,
          frame: state.checked,
          seq: 999,
          points: [
            { x: 0, y: 30 },
            { x: 100, y: 30 },
          ],
        },
      });
      expect(state.seats.p1!.score).toBe(score);
      apply({ type: 'player', now, playerId: 'p1', connected: true });
    }
    if (wave === 2) {
      apply({ type: 'vip', now, action: 'pause' });
      apply({
        type: 'timer',
        now: now + 500,
        phaseId: state.phase.id,
        startedAt: state.phase.startedAt,
      });
      apply({ type: 'vip', now: now + 700, action: 'resume' });
    }
  }
  expect(fuzzOnce(game, state, seed)).toEqual([]);
  apply({
    type: 'timer',
    now: state.endsAt,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
  apply({
    type: 'timer',
    now: state.phase.deadline!,
    phaseId: state.phase.id,
    startedAt: state.phase.startedAt,
  });
  expect(game.results(state)).not.toBeNull();
  expect(Object.keys(game.results(state)!.scores)).toHaveLength(count);
}

describe('seeded properties', () => {
  it.each([1, 2, 3])('replays seed %i with every player count', (seed) => {
    for (let count = 2; count <= 8; count++) trace(seed, count);
  });
  it('preserves invariants, totality and replay across 1000 random seeds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0x7fff_ffff }),
        fc.integer({ min: 2, max: 8 }),
        (seed, count) => trace(seed, count),
      ),
      { numRuns: 1000, seed: 20261011, endOnFailure: true },
    );
  }, 120_000);
});
