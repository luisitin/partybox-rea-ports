// SDK contract checks loaded only for this game, including fixtures, all presences and replay fuzzing.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { gameManifestSchema } from '@partybox/game-sdk';
import {
  finishGame,
  fuzzOnce,
  hashState,
  jsonSize,
  loadGame,
  makePlayers,
  playGame,
  replay,
} from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';
import { contractConfig } from './contract.config';

const loaded = await loadGame('word-guess-race');

function privateView(view: unknown, forbidden: string[]): void {
  const { players: _players, ...rest } = view as { players?: unknown };
  const text = JSON.stringify(rest);
  for (const word of forbidden) expect(text).not.toContain(word);
}

function views(state: State): void {
  const tv = game.tvView(state);
  expect(tv.gameId).toBe('word-guess-race');
  expect(tv.phaseId).toBe(state.phase.id);
  expect(jsonSize(tv)).toBeLessThan(64 * 1024);
  privateView(tv, contractConfig.hiddenFromTv(state));
  for (const id of [...Object.keys(state.players), 'spectator', '', '__proto__']) {
    const cv = game.controllerView(state, id);
    expect(cv.me.id).toBe(id);
    expect(cv.me.role).toBe(Object.hasOwn(state.players, id) ? 'player' : 'spectator');
    expect(JSON.parse(JSON.stringify(cv))).toEqual(cv);
    expect(jsonSize(cv)).toBeLessThan(64 * 1024);
    privateView(cv, contractConfig.hiddenFromController(state, id));
  }
}

describe('contract: games/word-guess-race', () => {
  it('manifest matches JSON, English content validates and every server file is pure', () => {
    expect(gameManifestSchema.safeParse(game.manifest).success).toBe(true);
    expect(game.manifest).toEqual(loaded.manifestJson);
    expect(game.phases).toEqual(['guess', 'reveal', 'done']);
    expect(game.manifest.supportsBots).toBe(true);
    for (const [name, pack] of Object.entries(loaded.content)) {
      expect(loaded.packs[name]).toBeDefined();
      expect(loaded.packs[name]!.safeParse(pack).success).toBe(true);
    }
    expect(Object.keys(loaded.packs).sort()).toEqual(Object.keys(loaded.content).sort());
    for (const { text } of loaded.serverSources) {
      const code = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/\b(Date\.now|Math\.random|setTimeout|setInterval|fetch)\s*\(/);
      expect(code).not.toMatch(/from\s+['"](node:|fs|path|os|crypto|child_process)/);
      expect(code).not.toMatch(/^(let|var)\s/m);
    }
  });

  it('every phase fixture renders, survives SDK fuzzing and reaches the same terminal scores', () => {
    for (const phase of game.phases) {
      const state = loaded.fixtures[phase] as State;
      expect(state).toBeDefined();
      expect(state.phase.id).toBe(phase);
      views(state);
      expect(jsonSize(state)).toBeLessThan(256 * 1024);
      expect(fuzzOnce(game, state, 7)).toEqual([]);
      expect(finishGame(game, state)).not.toBeNull();
    }
    const terminal = finishGame(game, loaded.fixtures['reveal-last']!);
    expect(terminal).not.toBeNull();
    expect(game.results(terminal as State)).toEqual(game.results(loaded.fixtures.done as State));
  });

  it('2, 5 and 8 seats terminate under SDK idle, fast, random and skip strategies', () => {
    for (const n of [2, 5, 8])
      for (const strategy of ['idle', 'fast', 'random', 'skipper'] as const)
        for (const roundSeconds of [60, 120, 180]) {
          const run = playGame(game, {
            players: n,
            seed: n * 31 + strategy.length,
            strategy,
            settings: { roundSeconds },
            maxSimMs: game.manifest.estimatedMinutes * 2 * 60_000,
          });
          expect(run.stuck).toBe(false);
          expect(run.invalidInputs).toEqual([]);
          expect(run.results).not.toBeNull();
          expect(Object.keys(run.results!.scores).sort()).toEqual(
            makePlayers(n)
              .map((p) => p.id)
              .sort(),
          );
          for (const score of Object.values(run.results!.scores))
            expect(Number.isFinite(score)).toBe(true);
          views(run.finalState as State);
        }
  });

  it('replays byte-identically in every presence and tolerates unknown senders at each phase', () => {
    for (const mode of ['together', 'remote-voice', 'remote-text'] as const)
      for (const phoneOnly of [false, true]) {
        const observed: State[] = [];
        const run = playGame(game, {
          players: 4,
          seed: 91,
          strategy: 'random',
          presence: { mode, phoneOnly },
          remote: 1,
          maxSimMs: 14 * 60_000,
          onEvent: (_event, state) => observed.push(state as State),
        });
        expect(run.stuck).toBe(false);
        expect(replay(game, run.init, run.events).at(-1)).toEqual(run.finalState);
        for (const state of observed.filter((_, i) => i % 6 === 0)) {
          const before = hashState(state);
          expect(fuzzOnce(game, state, 41)).toEqual([]);
          views(state);
          expect(hashState(state)).toBe(before);
        }
      }
  });

  it.each([1, 2, 3])(
    '1000 generated seeds preserve pure state, unique draws and private views (seed %i)',
    (seed) => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 0x7fffffff }), (drawSeed) => {
          const init = { players: makePlayers(8), settings: {}, now: 1234, seed: drawSeed };
          const state = game.init(init);
          expect(game.init(init)).toEqual(state);
          expect(new Set(state.answers).size).toBe(3);
          expect(
            state.answers.every((word) => typeof word === 'string' && /^[a-z]{5}$/.test(word)),
          ).toBe(true);
          const before = JSON.stringify(state);
          const after = game.reduce(state, {
            type: 'timer',
            phaseId: state.phase.id,
            startedAt: state.phase.startedAt,
            now: state.phase.deadline!,
          });
          expect(after.phase.id).toBe('reveal');
          expect(JSON.stringify(state)).toBe(before);
          expect(jsonSize(state)).toBeLessThan(256 * 1024);
          expect(game.tvView(state).solution).toBeNull();
          expect(game.controllerView(state, 'p1').guesses).toEqual([]);
        }),
        { seed, numRuns: 1000 },
      );
    },
  );
});
