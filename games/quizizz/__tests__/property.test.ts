// Replay and privacy properties across fixed seeds plus 1,000 reproducibly random seeds.
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { GameEvent, Rng } from '@partybox/game-sdk';
import { T0, finishGame, fuzzOnce, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Input, State } from '../server/types';

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  for (const item of Object.values(value)) deepFreeze(item);
  Object.freeze(value);
}

function forbidKeys(value: unknown, forbidden: readonly string[]): void {
  if (value === null || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (forbidden.includes(key)) throw new Error(`Private key leaked: ${key}`);
    forbidKeys(item, forbidden);
  }
}

function assertState(state: State): void {
  if (!game.phases.includes(state.phase.id)) throw new Error('Undeclared phase');
  const serialized = JSON.stringify(state);
  if (serialized.length > 256 * 1024 || JSON.stringify(JSON.parse(serialized)) !== serialized)
    throw new Error('State did not round-trip as bounded JSON');
  for (const r of Object.values(state.runners)) {
    for (const value of [r.answered, r.correct, r.score, r.streak, r.energy, r.freezeUntil])
      if (!Number.isFinite(value) || value < 0) throw new Error('Invalid runner number');
    if (r.correct > r.answered || r.answered > state.deck.length || r.streak > r.correct)
      throw new Error('Invalid question/streak accounting');
    if (r.energy > 1 || !Number.isInteger(r.energy)) throw new Error('Energy exceeded one charge');
    if (r.score < r.correct * 100 || r.score > r.correct * 320)
      throw new Error('Score left the declared 100–320 points-per-correct bounds');
  }
  forbidKeys(game.tvView(state), [
    'correctIndex',
    'deck',
    'runners',
    'question',
    'feedback',
    'explanation',
  ]);
  for (const id of [...Object.keys(state.players), 'ghost', '__proto__']) {
    const view = game.controllerView(state, id);
    forbidKeys(view, ['correctIndex', 'deck', 'runners']);
    if (view.me.role !== 'player' && (view.question !== null || view.feedback !== null))
      throw new Error('Spectator received a private question or verdict');
    if (
      view.feedback !== null &&
      JSON.stringify(view.feedback) !== JSON.stringify(state.runners[id]?.feedback)
    )
      throw new Error('Phone received a different player’s feedback');
  }
}

function nextEvent(state: State, rng: Rng, now: number): GameEvent<Input> {
  const ids = Object.keys(state.players);
  const id = ids[rng.int(0, ids.length - 1)]!;
  const runner = state.runners[id]!;
  const q = state.deck[Math.min(runner.answered, state.deck.length - 1)]!;
  const charge = rng.float() < 0.2 ? rng.int(1, 6) : Math.max(1, Math.floor(runner.correct / 3));
  switch (rng.int(0, 11)) {
    case 0:
    case 1:
    case 2:
      return {
        type: 'input',
        now,
        playerId: rng.float() < 0.1 ? '__proto__' : id,
        input: {
          type: 'answer',
          questionId: rng.float() < 0.15 ? 'stale-question' : q.id,
          index: Math.min(runner.answered, 19),
          choice: rng.int(0, 3),
        },
      };
    case 3:
      return {
        type: 'input',
        now,
        playerId: id,
        input: { type: 'next', index: Math.max(1, Math.min(20, runner.answered)) },
      };
    case 4:
      return {
        type: 'input',
        now,
        playerId: id,
        input: {
          type: 'power',
          power: 'freeze',
          charge,
          target: [...ids, 'ghost'][rng.int(0, ids.length)]!,
        },
      };
    case 5:
      return {
        type: 'input',
        now,
        playerId: id,
        input: { type: 'power', power: 'double', charge },
      };
    case 6:
      return { type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt };
    case 7:
      return { type: 'timer', now, phaseId: 'wrong-phase', startedAt: state.phase.startedAt - 1 };
    case 8:
      return {
        type: 'player',
        now,
        playerId: rng.float() < 0.1 ? 'ghost' : id,
        connected: rng.float() < 0.7,
      };
    case 9:
      return { type: 'vip', now, action: rng.float() < 0.45 ? 'pause' : 'resume' };
    case 10:
      return { type: 'speech', now, key: 'unknown-reading', ms: -1 };
    default:
      return { type: 'speechStart', now, key: 'unknown-reading' };
  }
}

function checkSeed(seed: number): void {
  const rng = createRng(seed);
  const init = {
    players: testPlayers(rng.int(2, 8)),
    seed,
    now: T0,
    settings: {
      pack: ['general', 'movies', 'science'][rng.int(0, 2)]!,
      questions: rng.int(6, 20),
      seconds: [60, 90, 180][rng.int(0, 2)]!,
      powers: rng.float() < 0.5,
    },
  };
  let state = game.init(init);
  let replay = game.init(init);
  let now = T0;
  assertState(state);
  for (let i = 0; i < 64; i++) {
    now += rng.int(0, 2500);
    const event = nextEvent(state, rng, now);
    const previous = JSON.stringify(state);
    deepFreeze(state);
    const next = game.reduce(state, event);
    replay = game.reduce(replay, event);
    if (JSON.stringify(state) !== previous) throw new Error(`Mutated previous state: seed=${seed}`);
    if (JSON.stringify(next) !== JSON.stringify(replay))
      throw new Error(`Nondeterministic replay: seed=${seed}`);
    state = next;
    assertState(state);
  }
  state = game.reduce(state, { type: 'vip', action: 'resume', now: now + 1 });
  const done = finishGame(game, state, 600) as State | null;
  if (done === null || game.results(done)?.ranking.length !== init.players.length)
    throw new Error(
      `Seed did not finish after reconnect/pause fuzz: seed=${seed}; ${JSON.stringify({
        phase: state.phase,
        clock: state.clock,
        began: state.began,
        endsAt: state.endsAt,
      })}`,
    );
  assertState(done);
  if (fuzzOnce(game, done, seed).length > 0)
    throw new Error(`Terminal reducer not total: seed=${seed}`);
}

describe('state properties', () => {
  it.each([1, 2, 3])(
    'fixed seed %i: deterministic immutable transitions, private views, totality',
    checkSeed,
  );
  const seeds = fc.sample(fc.integer({ min: 1, max: 0x7fffffff }), { seed: 0x503, numRuns: 1000 });
  const batches = Array.from({ length: 10 }, (_, batch) =>
    seeds.slice(batch * 100, batch * 100 + 100),
  );
  it.each(batches.map((batch, i) => [i + 1, batch] as const))(
    'random seed batch %i: 100 event sequences',
    (_batch, seeds) => {
      for (const seed of seeds) checkSeed(seed);
    },
    60_000,
  );

  it('changing hidden keys cannot change public views or a bot’s own choice', () => {
    const state = game.init({ players: testPlayers(8), seed: 3, settings: {}, now: T0 });
    const changed: State = {
      ...state,
      deck: state.deck.map((q) => ({
        ...q,
        correctIndex: (q.correctIndex + 1) % 4,
        explanation: 'PRIVATE_EXPLANATION_SENTINEL',
      })),
    };
    expect(game.tvView(changed)).toEqual(game.tvView(state));
    for (const id of [...Object.keys(state.players), 'ghost'])
      expect(game.controllerView(changed, id)).toEqual(game.controllerView(state, id));
    for (const skill of ['easy', 'normal', 'sharp'] as const)
      for (const seed of [1, 2, 3])
        expect(game.bot.sampleInput(changed, 'p1', createRng(seed), skill)).toEqual(
          game.bot.sampleInput(state, 'p1', createRng(seed), skill),
        );
  });

  it.each([2, 3, 4, 5, 6, 7, 8])('%i idle players finish at every setting extreme', (count) => {
    for (const questions of [6, 20])
      for (const seconds of [60, 180])
        for (const powers of [false, true]) {
          const state = game.init({
            players: testPlayers(count),
            seed: 1,
            settings: { questions, seconds, powers },
            now: T0,
          });
          const done = finishGame(game, state, 600) as State | null;
          expect(done?.phase.id).toBe('done');
          expect(game.results(done!)?.ranking).toHaveLength(count);
          expect(done!.phase.startedAt - T0).toBeLessThanOrEqual(
            game.manifest.estimatedMinutes * 2 * 60_000,
          );
          expect(Object.values(done!.runners).every((r) => r.answered === 0 && r.score === 0)).toBe(
            true,
          );
        }
  });
});
