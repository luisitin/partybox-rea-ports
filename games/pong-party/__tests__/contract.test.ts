// The real SDK contract building blocks, scoped to this game so local runners
// never discover or exercise other runners' games.
import { describe, expect, it } from 'vitest';
import { gameManifestSchema, PRESENCE_MODES } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';
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

const loaded = await loadGame('pong-party');
const BUDGET = game.manifest.estimatedMinutes * 3 * 60_000;
const FORBIDDEN = [
  /\bDate\.now\s*\(/,
  /\bnew\s+Date\s*\(/,
  /\bMath\.random\s*\(/,
  /\bset(Timeout|Interval|Immediate)\s*\(/,
  /\bfetch\s*\(/,
  /\brequire\s*\(/,
  /from\s+['"](node:|fs|path|os|crypto|child_process)/,
  /\bawait\b/,
  /^(let|var)\s/m,
];

function checkViews(state: GameStateBase): void {
  const ids = [...Object.keys(state.players), 'spectator-x', 'ghost', '', '__proto__'];
  const views = [
    loaded.game.tvView(state),
    ...ids.map((id) => loaded.game.controllerView(state, id)),
  ];
  for (const view of views) {
    expect(view.gameId).toBe('pong-party');
    expect(view.phaseId).toBe(state.phase.id);
    expect(view.deadline === null || typeof view.deadline === 'number').toBe(true);
    expect(typeof view.paused).toBe('boolean');
    expect(view.players).toBeInstanceOf(Array);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    expect(jsonSize(view)).toBeLessThanOrEqual(64 * 1024);
    const { players: _players, ...privatePart } = view;
    const text = JSON.stringify(privatePart);
    for (const key of ['spawnAngles', 'rng']) expect(text).not.toContain(`"${key}"`);
    for (const player of view.players)
      expect(['active', 'submitted', 'waiting', 'spectator']).toContain(player.status);
  }
  for (const id of ids) {
    const view = loaded.game.controllerView(state, id);
    expect(view.me.id).toBe(id);
    expect(view.me.role).toBe(Object.hasOwn(state.players, id) ? 'player' : 'spectator');
  }
}

describe('contract: games/pong-party', () => {
  it('validates the manifest, phase list, and content schemas', () => {
    expect(gameManifestSchema.safeParse(game.manifest).success).toBe(true);
    expect(game.manifest).toEqual(loaded.manifestJson);
    expect(game.manifest.id).toBe('pong-party');
    expect(new Set(game.phases).size).toBe(game.phases.length);
    for (const name of Object.keys(loaded.content))
      expect(loaded.packs[name]?.safeParse(loaded.content[name]).success, name).toBe(true);
    expect(Object.keys(loaded.packs).sort()).toEqual(Object.keys(loaded.content).sort());
  });

  it('server sources obey the SDK purity boundary', () => {
    for (const { file, text } of loaded.serverSources) {
      const code = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const forbidden of FORBIDDEN) expect(code, file).not.toMatch(forbidden);
    }
  });

  it('every declared phase has a JSON fixture that renders, survives fuzz, and plays on', () => {
    for (const phase of game.phases) {
      const fixture = loaded.fixtures[phase];
      expect(fixture, phase).toBeDefined();
      if (!fixture) continue;
      expect(fixture.phase.id).toBe(phase);
      expect(jsonSize(fixture)).toBeLessThanOrEqual(256 * 1024);
      checkViews(fixture);
      expect(fuzzOnce(loaded.game, fixture, 7)).toEqual([]);
      expect(finishGame(loaded.game, fixture, 2000)).not.toBeNull();
    }
    const score = loaded.fixtures['score'];
    const done = loaded.fixtures['done'];
    expect(score).toBeDefined();
    expect(done).toBeDefined();
    if (score && done)
      expect(loaded.game.results(done)).toEqual(
        loaded.game.results(finishGame(loaded.game, score, 2000)!),
      );
  });

  it.each([2, 4, 8])('initializes a JSON state at %i players', (n) => {
    const state = game.init({ players: makePlayers(n), settings: {}, seed: n, now: 1000 });
    expect(game.phases).toContain(state.phase.id);
    expect(Object.keys(state.players)).toHaveLength(n);
    expect(state.rng).toEqual({ seed: expect.any(Number), step: expect.any(Number) });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(game.results(state)).toBeNull();
    checkViews(state);
  });

  it.each(['random', 'fast', 'idle', 'skipper'] as const)(
    'terminates with SDK %s strategies, complete finite results and replay',
    (strategy) => {
      for (const n of [2, 4, 8]) {
        const visited: GameStateBase[] = [];
        const run = playGame(loaded.game, {
          players: n,
          seed: n * 31 + strategy.length,
          strategy,
          maxSimMs: BUDGET,
          maxEvents: 20_000,
          onEvent: (_event, state) => visited.push(state),
        });
        expect(run.invalidInputs).toEqual([]);
        expect(run.stuck, `${strategy}/${n}`).toBe(false);
        expect(run.results).not.toBeNull();
        const result = run.results!;
        const ids = run.init.players.map((player) => player.id).sort();
        expect(Object.keys(result.scores).sort()).toEqual(ids);
        expect(result.ranking.map((row) => row.playerId).sort()).toEqual(ids);
        expect(result.winnerIds.length).toBeGreaterThan(0);
        for (const row of result.ranking) {
          expect(Number.isFinite(row.score)).toBe(true);
          expect(row.score).toBe(result.scores[row.playerId]);
        }
        for (const winner of result.winnerIds)
          expect(result.ranking.find((row) => row.playerId === winner)?.rank).toBe(1);
        expect(replay(loaded.game, run.init, run.events).slice(1).map(hashState)).toEqual(
          visited.map(hashState),
        );
        const sampleEvery = Math.max(1, Math.floor(visited.length / 12));
        for (let i = 0; i < visited.length; i += sampleEvery) {
          const state = visited[i]!;
          expect(jsonSize(state)).toBeLessThanOrEqual(256 * 1024);
          expect(fuzzOnce(loaded.game, state, i)).toEqual([]);
          checkViews(state);
          expect(
            loaded.game.reduce(state, {
              type: 'timer',
              now: state.phase.startedAt + 1,
              phaseId: state.phase.id,
              startedAt: state.phase.startedAt - 1,
            }),
          ).toEqual(state);
        }
      }
    },
    60_000,
  );

  it('bots produce varied schema-valid moves rather than a fixed placeholder', () => {
    const moves = new Set<string>();
    const run = playGame(loaded.game, {
      players: 8,
      seed: 2024,
      strategy: 'fast',
      maxSimMs: BUDGET,
      maxEvents: 20_000,
      onEvent: (event) => {
        if (event.type === 'input') moves.add(JSON.stringify(event.input));
      },
    });
    expect(run.stuck).toBe(false);
    expect(run.invalidInputs).toEqual([]);
    expect(moves.size).toBeGreaterThan(1);
  });

  it.each(
    PRESENCE_MODES.flatMap((mode) => [false, true].map((phoneOnly) => ({ mode, phoneOnly }))),
  )('finishes in $mode with phoneOnly=$phoneOnly', ({ mode, phoneOnly }) => {
    const run = playGame(loaded.game, {
      players: 2,
      seed: 31,
      strategy: 'random',
      maxSimMs: BUDGET,
      maxEvents: 20_000,
      presence: { mode, phoneOnly },
      remote: mode === 'together' ? 0 : 1,
    });
    expect(run.stuck).toBe(false);
    expect(run.init.presence).toEqual({ mode, phoneOnly });
    expect(hashState(replay(loaded.game, run.init, run.events).at(-1))).toBe(
      hashState(run.finalState),
    );
  });
});
