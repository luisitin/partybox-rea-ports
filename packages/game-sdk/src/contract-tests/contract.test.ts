// The game contract suite (docs/GAME_CONTRACT.md "Rules"), run against EVERY folder in games/.
// Game-agnostic on purpose: it only knows GameDefinition, the fixture convention, content/schema.ts
// `packs` and the optional __tests__/contract.config.ts.
import { describe, expect, it } from 'vitest';
import type { GameStateBase } from '@partybox/shared';
import {
  PRESENCE_MODES,
  STATE_SIZE_LIMIT_BYTES,
  gameManifestSchema,
  playerCountRange,
} from '@partybox/shared';
import type { Settings } from '@partybox/shared';
import { fuzzOnce } from './fuzz';
import { hashState, jsonSize } from './hash';
import { listGameIds, loadGame, shardIds } from './load';
import type { LoadedGame } from './load';
import { defaultSettingsOf, finishGame, makePlayers, playGame, replay, T0 } from './play';
import type { PlayStrategy } from './play';

// vitest.config.ts runs this file once per shard (PB_CONTRACT_SHARD=k/n, T-0565); run alone it plays every game.
const games = await Promise.all(
  shardIds(listGameIds(), process.env['PB_CONTRACT_SHARD']).map((id) => loadGame(id)),
);
const VIEW_SIZE_LIMIT = 64 * 1024;
const FORBIDDEN_SOURCE = [
  /\bDate\.now\s*\(/,
  /\bnew\s+Date\s*\(/,
  /\bMath\.random\s*\(/,
  /\bset(Timeout|Interval|Immediate)\s*\(/,
  /\bfetch\s*\(/,
  /\brequire\s*\(/,
  /from\s+['"](node:|fs|path|os|crypto|child_process)/,
  /\bawait\b/,
];

/** The fixture done.json must continue: config, else `<phase before done>-last`, else that phase. */
function lastScoresFixture(loaded: LoadedGame): string | null {
  if (loaded.config.lastScores !== undefined) return loaded.config.lastScores;
  const phases = loaded.game.phases;
  const before = phases[phases.indexOf('done') - 1];
  if (!before) return null;
  if (loaded.fixtures[`${before}-last`]) return `${before}-last`;
  return loaded.fixtures[before] ? before : null;
}

function playerCounts(game: LoadedGame, settings: Settings = {}): number[] {
  const [minPlayers, maxPlayers] = playerCountRange(game.game.manifest, settings);
  const mid = Math.floor((minPlayers + maxPlayers) / 2);
  return [...new Set([minPlayers, mid, maxPlayers])];
}

function expectEnvelope(view: unknown, gameId: string, state: GameStateBase): void {
  expect(view).toBeTypeOf('object');
  const v = view as Record<string, unknown>;
  expect(v['gameId']).toBe(gameId);
  expect(v['phaseId']).toBe(state.phase.id);
  expect(v['deadline'] === null || typeof v['deadline'] === 'number').toBe(true);
  expect(typeof v['paused']).toBe('boolean');
  expect(Array.isArray(v['players'])).toBe(true);
  for (const p of v['players'] as Record<string, unknown>[]) {
    expect(typeof p['id']).toBe('string');
    expect(typeof p['name']).toBe('string');
    expect(['active', 'submitted', 'waiting', 'spectator']).toContain(p['status']);
  }
  expect(jsonSize(view)).toBeLessThanOrEqual(VIEW_SIZE_LIMIT);
  expect(JSON.parse(JSON.stringify(view))).toEqual(view);
}

function expectNoLeak(view: unknown, hidden: string[], where: string): void {
  // The envelope's players[] (names, avatar ids) is public by definition and may coincide with
  // a secret ("penguin" is an avatar AND a word) — only the game-specific part is inspected.
  const { players: _players, ...rest } = view as { players?: unknown };
  const text = JSON.stringify(rest);
  for (const secret of hidden) {
    if (typeof secret !== 'string' || secret.length < 3) continue;
    expect(text, `${where} leaks "${secret}"`).not.toContain(JSON.stringify(secret).slice(1, -1));
  }
}

function checkViews(loaded: LoadedGame, state: GameStateBase, where: string): void {
  const { game, config } = loaded;
  const ids = [...Object.keys(state.players), 'spectator-x', 'ghost', ''];
  const tv = game.tvView(state);
  expectEnvelope(tv, game.manifest.id, state);
  if (config.hiddenFromTv) expectNoLeak(tv, config.hiddenFromTv(state), `${where} tvView`);
  for (const id of ids) {
    const cv = game.controllerView(state, id);
    expectEnvelope(cv, game.manifest.id, state);
    expect(cv.me.id).toBe(id);
    expect(cv.me.role).toBe(state.players[id] ? 'player' : 'spectator');
    if (config.hiddenFromController)
      expectNoLeak(cv, config.hiddenFromController(state, id), `${where} controllerView(${id})`);
  }
}

function checkResults(loaded: LoadedGame, state: GameStateBase, initIds: string[]): void {
  const results = loaded.game.results(state);
  expect(results).not.toBeNull();
  if (!results) return;
  for (const id of initIds) {
    expect(results.scores, `score for ${id}`).toHaveProperty(id);
    expect(Number.isFinite(results.scores[id])).toBe(true);
  }
  expect(results.ranking.map((r) => r.playerId).sort()).toEqual(Object.keys(results.scores).sort());
  // computer seats the game fills are ranked beside the players, and only they may be extra
  const seatIds = (results.seats ?? []).map((s) => s.id);
  expect(Object.keys(results.scores).sort()).toEqual([...initIds, ...seatIds].sort());
  for (const row of results.ranking) expect(row.score).toBe(results.scores[row.playerId]);
  // ADR-052: only a co-op game the players lost may crown nobody.
  if (!(results.outcome?.kind === 'coop' && !results.outcome.won))
    expect(results.winnerIds.length).toBeGreaterThan(0);
  for (const id of results.winnerIds)
    expect(results.ranking.find((r) => r.playerId === id)?.rank).toBe(1);
  for (const award of results.awards) expect(initIds).toContain(award.playerId);
}

for (const loaded of games) {
  const { game, id } = loaded;
  const variants = [{}, ...(loaded.config.settingsVariants ?? [])];
  const budgetMs = game.manifest.unlimitedDuration
    ? 7 * 24 * 60 * 60_000
    : game.manifest.estimatedMinutes * 3 * 60_000;

  describe(`contract: games/${id}`, () => {
    it('manifest is valid, matches manifest.json, phases are declared', () => {
      expect(gameManifestSchema.safeParse(game.manifest).success).toBe(true);
      expect(game.manifest).toEqual(loaded.manifestJson);
      // Folders starting with _ (the template) carry the id without the underscore.
      expect(game.manifest.id).toBe(id.replace(/^_/, ''));
      expect(game.phases.length).toBeGreaterThan(0);
      expect(new Set(game.phases).size).toBe(game.phases.length);
      expect(typeof game.bot?.sampleInput).toBe('function');
    });

    it('server code is pure (no clocks, randomness, timers, I/O, await)', () => {
      for (const { file, text } of loaded.serverSources) {
        const code = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const pattern of FORBIDDEN_SOURCE)
          expect(code, `${file} matches ${pattern}`).not.toMatch(pattern);
        expect(code, `${file} has module-level let/var`).not.toMatch(/^(let|var)\s/m);
      }
    });

    it('content packs validate against content/schema.ts packs', () => {
      const names = Object.keys(loaded.content);
      for (const name of names) {
        const schema = loaded.packs[name];
        expect(
          schema,
          `content/${name}.json has no entry in content/schema.ts packs`,
        ).toBeDefined();
        const parsed = schema?.safeParse(loaded.content[name]);
        expect(
          parsed?.success,
          `content/${name}.json: ${parsed?.success ? '' : parsed?.error.message}`,
        ).toBe(true);
      }
      for (const name of Object.keys(loaded.packs))
        expect(names, `packs lists ${name} but content/${name}.json is missing`).toContain(name);
    });

    it('has a fixture for every phase that renders both views safely', () => {
      for (const phase of game.phases) {
        const fixture = loaded.fixtures[phase];
        expect(fixture, `fixtures/${phase}.json`).toBeDefined();
        if (!fixture) continue;
        expect(fixture.phase.id).toBe(phase);
        expect(jsonSize(fixture)).toBeLessThanOrEqual(STATE_SIZE_LIMIT_BYTES);
        checkViews(loaded, fixture, `fixtures/${phase}.json`);
        expect(fuzzOnce(game, fixture, 7)).toEqual([]);
        // Played on with nobody playing, a fixture must not throw (a stale shape does, T-0207).
        expect(() => finishGame(game, fixture), `fixtures/${phase}.json played on`).not.toThrow();
      }
    });

    it('the done fixture is the last scores fixture played out (one game, T-0207)', () => {
      const name = lastScoresFixture(loaded);
      const done = loaded.fixtures['done'];
      if (!name || !done) return;
      const from = loaded.fixtures[name];
      expect(from, `fixtures/${name}.json`).toBeDefined();
      if (!from) return;
      const end = finishGame(game, from);
      expect(end, `fixtures/${name}.json never reaches the end with nobody playing`).not.toBeNull();
      if (!end) return;
      expect(
        game.results(done),
        `fixtures/done.json is another game than fixtures/${name}.json: pnpm sim --game ${id} --finish-fixtures`,
      ).toEqual(game.results(end));
    });

    it('init produces a declared phase for min, mid and max players', () => {
      for (const settings of variants)
        for (const n of playerCounts(loaded, settings)) {
          const state = game.init({
            players: makePlayers(n),
            settings: { ...defaultSettingsOf(game), ...settings },
            seed: n,
            now: T0,
          });
          expect(game.phases).toContain(state.phase.id);
          expect(Object.keys(state.players)).toHaveLength(n);
          expect(state.rng).toEqual({ seed: expect.any(Number), step: expect.any(Number) });
          expect(JSON.parse(JSON.stringify(state))).toEqual(state);
          expect(game.results(state)).toBeNull();
        }
    });

    if (game.manifest.unlimitedDuration)
      it('idle play persists beyond the estimate until the VIP explicitly ends it', () => {
        let s = game.init({
          players: makePlayers(game.manifest.minPlayers),
          settings: defaultSettingsOf(game),
          seed: 31,
          now: T0,
        });
        // A short opening step may carry a deadline (Monopoly's 30 s piece pick); the open-ended
        // play that follows must not. Let each opening deadline fire, then require none.
        for (let i = 0; i < 4 && s.phase.deadline !== null; i++)
          s = game.reduce(s, {
            type: 'timer',
            now: s.phase.deadline,
            phaseId: s.phase.id,
            startedAt: s.phase.startedAt,
          });
        expect(s.phase.deadline).toBeNull();
        const later = game.reduce(s, {
          type: 'timer',
          now: T0 + budgetMs,
          phaseId: s.phase.id,
          startedAt: s.phase.startedAt,
        });
        expect(later).toEqual(s);
        expect(game.results(later)).toBeNull();
        checkResults(
          loaded,
          game.reduce(later, { type: 'vip', now: T0 + budgetMs, action: 'end' }),
          Object.keys(s.players),
        );
      });
    const strategies: PlayStrategy[] = game.manifest.unlimitedDuration
      ? ['random', 'fast', 'skipper']
      : ['random', 'fast', 'idle', 'skipper'];
    for (const strategy of strategies) {
      it(
        `terminates with ${strategy} bots within the ${game.manifest.unlimitedDuration ? 'extended simulation budget' : 'estimate × 3'}, results complete`,
        () => {
          for (const settings of variants) {
            for (const n of playerCounts(loaded, settings)) {
              const seed = n * 31 + strategy.length;
              const visited: GameStateBase[] = [];
              const run = playGame(game, {
                players: n,
                seed,
                strategy,
                settings,
                maxSimMs: budgetMs,
                ...(game.manifest.unlimitedDuration ? { maxEvents: 20_000 } : {}),
                onEvent: (_e, s) => visited.push(s),
              });
              const label = `${strategy} n=${n} settings=${JSON.stringify(settings)}`;
              expect(run.invalidInputs, `${label}: bot produced schema-invalid input`).toEqual([]);
              expect(
                run.stuck,
                `${label}: stuck in phase ${run.finalState.phase.id} after ${run.events.length} events / ${Math.round(run.simMs / 1000)} s`,
              ).toBe(false);
              expect(run.results, label).not.toBeNull();
              checkResults(
                loaded,
                run.finalState,
                run.init.players.map((p) => p.id),
              );
              for (const s of visited) {
                expect(game.phases, `${label}: undeclared phase ${s.phase.id}`).toContain(
                  s.phase.id,
                );
                expect(jsonSize(s)).toBeLessThanOrEqual(STATE_SIZE_LIMIT_BYTES);
              }
              const step = Math.max(1, Math.floor(visited.length / 12));
              for (let i = 0; i < visited.length; i += step)
                checkViews(loaded, visited[i] as GameStateBase, `${label} event ${i}`);
            }
          }
        },
        // An unlimited game plays up to 20k events per variant and size; on a loaded PC that passes 60 s.
        // Every other game takes the 60 s default from vitest.config.ts.
        game.manifest.unlimitedDuration ? 120_000 : undefined,
      );
    }

    it(`bot support flag: ${game.manifest.supportsBots ? 'bots act in every input phase with varied inputs' : 'not declared (players cannot add bots to this game)'}`, () => {
      if (!game.manifest.supportsBots) return;
      // ADR-028: a game that welcomes bots must have a bot that actually plays — it acts at least
      // and its inputs are not all identical (a bot that always taps A is not an opponent).
      const inputsByPhase = new Map<string, Set<string>>();
      playGame(game, {
        players: playerCounts(loaded).at(-1) as number,
        seed: 2024,
        strategy: 'fast',
        maxSimMs: budgetMs,
        onEvent: (event, state) => {
          if (event.type !== 'input') return;
          const phase = state.phase.id;
          if (!inputsByPhase.has(phase)) inputsByPhase.set(phase, new Set());
          inputsByPhase.get(phase)?.add(JSON.stringify(event.input));
        },
      });
      const all = [...inputsByPhase.values()].flatMap((set) => [...set]);
      expect(all.length, 'the bot never produced an input').toBeGreaterThan(0);
      if (all.length >= 4)
        expect(new Set(all).size, 'bot inputs are all identical').toBeGreaterThan(1);
    });

    it('is deterministic: same seed + same events ⇒ identical state after every event', () => {
      const visited: GameStateBase[] = [];
      const run = playGame(game, {
        players: playerCounts(loaded)[0] as number,
        seed: 99,
        strategy: 'random',
        maxSimMs: budgetMs,
        onEvent: (_e, s) => visited.push(s),
      });
      // One replay (T-0910; it was two, each compared only with the other), matched with every state the run passed through.
      const replayed = replay(game, run.init, run.events).map(hashState);
      expect(replayed.slice(1)).toEqual(visited.map(hashState));
      expect(replayed.at(-1)).toBe(hashState(run.finalState));
    });

    // Presence is a seeded input: a game may switch features on it, never stall or diverge. One
    // case per mode × phone only, at the fewest players (six full games at max players in one `it`
    // was every branch's flaky verify step, reviewer C1).
    const presences = PRESENCE_MODES.flatMap((mode) =>
      [false, true].map((phoneOnly) => ({ mode, phoneOnly })),
    );
    it.each(presences)(
      'plays through in presence $mode, phone only $phoneOnly (ADR-047)',
      ({ mode, phoneOnly }) => {
        const options = {
          players: playerCounts(loaded)[0] as number,
          seed: 31,
          strategy: 'random' as const,
          maxSimMs: budgetMs,
          presence: { mode, phoneOnly },
          remote: mode === 'together' ? 0 : 1,
        };
        const run = playGame(game, options);
        expect(run.stuck).toBe(false);
        expect(run.init.presence).toEqual({ mode, phoneOnly });
        const again = replay(game, run.init, run.events).map(hashState);
        expect(again.at(-1), 'not deterministic').toBe(hashState(run.finalState));
      },
    );

    it('ignores stale timers and survives fuzzed events mid-game', () => {
      const visited: GameStateBase[] = [];
      playGame(game, {
        players: playerCounts(loaded).at(-1) as number,
        seed: 5,
        strategy: 'random',
        maxSimMs: budgetMs,
        onEvent: (_e, s) => visited.push(s),
      });
      const step = Math.max(1, Math.floor(visited.length / 8));
      for (let i = 0; i < visited.length; i += step) {
        const state = visited[i] as GameStateBase;
        const stale = game.reduce(state, {
          type: 'timer',
          now: state.phase.startedAt + 1,
          phaseId: state.phase.id,
          startedAt: state.phase.startedAt - 1,
        });
        expect(stale.phase, `stale timer changed the phase at event ${i}`).toEqual(state.phase);
        expect(fuzzOnce(game, state, i)).toEqual([]);
      }
    });
  });
}

describe('contract suite', () => {
  it('found at least one game folder', () => {
    expect(listGameIds().length).toBeGreaterThan(0);
  });
});
