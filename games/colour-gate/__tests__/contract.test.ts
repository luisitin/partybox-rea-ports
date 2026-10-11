// Only this game's SDK contract building blocks run; importing the global suite would run every game.
import { describe, expect, it } from 'vitest';
import { gameManifestSchema } from '@partybox/game-sdk';
import {
  defaultSettingsOf,
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

const loaded = await loadGame('colour-gate');
const budgetMs = game.manifest.estimatedMinutes * 2 * 60_000;

function checkView(state: State, id: string) {
  const tv = game.tvView(state);
  const phone = game.controllerView(state, id);
  for (const v of [tv, phone]) {
    expect(v.gameId).toBe('colour-gate');
    expect(v.phaseId).toBe(state.phase.id);
    expect(typeof v.paused).toBe('boolean');
    expect(v.phaseAt).toBeTypeOf('number');
    expect(v.deadline === null || Number.isFinite(v.deadline)).toBe(true);
    expect(v.players).toHaveLength(Object.keys(state.players).length);
    expect(jsonSize(v)).toBeLessThanOrEqual(64 * 1024);
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
    expect(v.world).toEqual(state.world);
  }
  expect(phone.me.id).toBe(id);
  expect(phone.me.role).toBe(Object.hasOwn(state.players, id) ? 'player' : 'spectator');
  expect(phone.runner).toEqual(state.world.runners.find((r) => r.id === id) ?? null);
}

describe('SDK contract: Colour Gate', () => {
  it('has a valid exact manifest, declared phases and pure server sources', () => {
    expect(gameManifestSchema.safeParse(game.manifest).success).toBe(true);
    expect(game.manifest).toEqual(loaded.manifestJson);
    expect(game.phases).toEqual(['play', 'score', 'done']);
    for (const { text } of loaded.serverSources) {
      const code = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(
        /\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bMath\.random\s*\(|\bset(?:Timeout|Interval|Immediate)\s*\(|\bfetch\s*\(|\brequire\s*\(|\bawait\b/,
      );
      expect(code).not.toMatch(/from\s+['"](?:node:|fs|path|os|crypto|child_process)/);
      expect(code).not.toMatch(/^(let|var)\s/m);
    }
  });

  it('validates every content pack and full phase fixtures, fuzzes totality and continues the final score fixture', () => {
    expect(Object.keys(loaded.content).sort()).toEqual(Object.keys(loaded.packs).sort());
    for (const [key, content] of Object.entries(loaded.content))
      expect(loaded.packs[key]!.safeParse(content).success).toBe(true);
    for (const phase of game.phases) {
      const fixture = loaded.fixtures[phase] as State;
      expect(fixture).toBeDefined();
      expect(fixture.phase.id).toBe(phase);
      expect(jsonSize(fixture)).toBeLessThanOrEqual(256 * 1024);
      for (const id of [...Object.keys(fixture.players), 'spectator', '', '__proto__'])
        checkView(fixture, id);
      for (const seed of [1, 2, 3]) expect(fuzzOnce(game, fixture, seed)).toEqual([]);
      expect(finishGame(game, fixture, 4000)).not.toBeNull();
    }
    const from = loaded.fixtures['score-last'] as State;
    expect(from).toBeDefined();
    const final = finishGame(game, from, 4000)! as State;
    expect(game.results(loaded.fixtures.done as State)).toEqual(game.results(final));
    expect(Object.values(game.results(final)!.scores).some((score) => score > 0)).toBe(true);
  });

  it.each(['idle', 'fast', 'random', 'skipper'] as const)(
    'terminates with %s at 2, 4, 8 players, preserves JSON, complete scores and replay',
    (strategy) => {
      for (const count of [2, 4, 8])
        for (const rounds of [1, 3]) {
          const visited: State[] = [];
          const run = playGame(game, {
            players: count,
            seed: count * 31 + rounds,
            strategy,
            settings: { rounds },
            maxSimMs: budgetMs,
            maxEvents: 30_000,
            onEvent: (_e, s) => visited.push(s as State),
          });
          expect(run.stuck).toBe(false);
          expect(run.invalidInputs).toEqual([]);
          expect(run.simMs).toBeLessThanOrEqual(budgetMs);
          expect(run.results).not.toBeNull();
          expect(Object.keys(run.results!.scores).sort()).toEqual(
            makePlayers(count)
              .map((p) => p.id)
              .sort(),
          );
          expect(run.results!.ranking.map((r) => r.playerId).sort()).toEqual(
            Object.keys(run.results!.scores).sort(),
          );
          for (const row of run.results!.ranking) {
            expect(Number.isFinite(row.score)).toBe(true);
            expect(row.score).toBe(run.results!.scores[row.playerId]);
          }
          expect(run.results!.winnerIds.length).toBeGreaterThan(0);
          const replayed = replay(game, run.init, run.events);
          expect(replayed.slice(1).map(hashState)).toEqual(visited.map(hashState));
          for (const s of visited.filter((_s, i) => i % 50 === 0)) {
            expect(JSON.parse(JSON.stringify(s))).toEqual(s);
            expect(jsonSize(s)).toBeLessThanOrEqual(256 * 1024);
            expect(fuzzOnce(game, s, 3)).toEqual([]);
            checkView(s, 'p1');
            checkView(s, 'spectator');
          }
        }
    },
    60_000,
  );

  it('supports all six presence configurations without changing the fair course or stalling', () => {
    for (const mode of ['together', 'remote-voice', 'remote-text'] as const)
      for (const phoneOnly of [false, true]) {
        const run = playGame(game, {
          players: 2,
          seed: 31,
          strategy: 'idle',
          settings: { rounds: 1 },
          presence: { mode, phoneOnly },
          remote: mode === 'together' ? 0 : 1,
          maxSimMs: budgetMs,
        });
        expect(run.stuck).toBe(false);
        checkView(run.finalState as State, 'p1');
        const initial = game.init({
          players: makePlayers(2),
          seed: 31,
          now: 1000,
          settings: defaultSettingsOf(game),
          presence: { mode, phoneOnly },
        });
        expect(game.controllerView(initial, 'p1').phoneStage).toBe(phoneOnly);
      }
  });
});
