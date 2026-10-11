import { describe, expect, it } from 'vitest';
import { gameManifestSchema } from '@partybox/game-sdk';
import type { GameStateBase } from '@partybox/game-sdk';
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
  T0,
} from '@partybox/game-sdk/testing';
import { game } from '../server/index';

const loaded = await loadGame('crossy-streets');
const STATE_BUDGET = 256 * 1024;
const VIEW_BUDGET = 64 * 1024;
const budget = game.manifest.estimatedMinutes * 2 * 60_000;

function checkViews(state: GameStateBase): void {
  const tv = loaded.game.tvView(state);
  const views = [
    tv,
    ...[...Object.keys(state.players), 'spectator-x', '', '__proto__'].map((id) =>
      loaded.game.controllerView(state, id),
    ),
  ];
  for (const view of views) {
    expect(view.gameId).toBe('crossy-streets');
    expect(view.phaseId).toBe(state.phase.id);
    expect(typeof view.paused).toBe('boolean');
    expect(view.deadline === null || Number.isFinite(view.deadline)).toBe(true);
    expect(Array.isArray(view.players)).toBe(true);
    expect(jsonSize(view)).toBeLessThanOrEqual(VIEW_BUDGET);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    expect(JSON.stringify(view)).not.toContain('"rng"');
  }
  for (const id of [...Object.keys(state.players), 'spectator-x', '', '__proto__']) {
    const cv = loaded.game.controllerView(state, id);
    expect(cv.me.id).toBe(id);
    expect(cv.me.role).toBe(Object.hasOwn(state.players, id) ? 'player' : 'spectator');
  }
}

function checkResults(state: GameStateBase): void {
  const results = loaded.game.results(state);
  expect(results).not.toBeNull();
  if (!results) return;
  const ids = Object.keys(state.players).sort();
  expect(Object.keys(results.scores).sort()).toEqual(ids);
  expect(results.ranking.map((r) => r.playerId).sort()).toEqual(ids);
  expect(results.winnerIds.length).toBeGreaterThan(0);
  for (const row of results.ranking) {
    expect(Number.isFinite(row.score)).toBe(true);
    expect(row.score).toBe(results.scores[row.playerId]);
  }
  for (const id of results.winnerIds) {
    expect(results.ranking.find((row) => row.playerId === id)?.rank).toBe(1);
  }
  for (const award of results.awards) expect(ids).toContain(award.playerId);
}

describe('SDK contract: games/crossy-streets', () => {
  it('loads the actual SDK discovery manifest, sources and content schema', () => {
    expect(gameManifestSchema.safeParse(game.manifest).success).toBe(true);
    expect(game.manifest).toEqual(loaded.manifestJson);
    expect(game.phases).toEqual(['play', 'score', 'done']);
    expect(game.manifest.supportsBots).toBe(true);
    for (const [name, value] of Object.entries(loaded.content)) {
      expect(loaded.packs[name]?.safeParse(value).success, `content/${name}.json`).toBe(true);
    }
    expect(Object.keys(loaded.packs).sort()).toEqual(Object.keys(loaded.content).sort());
    const forbidden = [
      /\bDate\.now\s*\(/,
      /\bnew\s+Date\s*\(/,
      /\bMath\.random\s*\(/,
      /\bset(Timeout|Interval|Immediate)\s*\(/,
      /\bfetch\s*\(/,
      /from\s+['"](node:|fs|path|os|crypto|child_process)/,
      /\bawait\b/,
      /^(let|var)\s/m,
    ];
    for (const source of loaded.serverSources) {
      const code = source.text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const pattern of forbidden) expect(code, source.file).not.toMatch(pattern);
    }
  });

  it('has resumable fixtures for every phase and one continuous score-to-done game', () => {
    for (const phase of game.phases) {
      const state = loaded.fixtures[phase];
      expect(state, `${phase}.json`).toBeDefined();
      if (!state) continue;
      expect(state.phase.id).toBe(phase);
      expect(jsonSize(state)).toBeLessThanOrEqual(STATE_BUDGET);
      checkViews(state);
      expect(fuzzOnce(loaded.game, state, 7)).toEqual([]);
      expect(finishGame(loaded.game, state, 2000)).not.toBeNull();
    }
    expect(finishGame(loaded.game, loaded.fixtures['score']!, 2000)).toEqual(
      loaded.fixtures['done'],
    );
  });

  it.each(['random', 'fast', 'idle', 'skipper'] as const)(
    'passes the SDK %s runner, event replay, result and JSON budgets',
    (strategy) => {
      for (const count of [2, 5, 8]) {
        const visited: GameStateBase[] = [];
        const run = playGame(loaded.game, {
          players: count,
          seed: count * 31 + strategy.length,
          strategy,
          maxSimMs: budget,
          maxEvents: 30_000,
          onEvent: (_event, state) => visited.push(state),
        });
        expect(run.stuck, `${strategy} ${count} players`).toBe(false);
        expect(run.invalidInputs).toEqual([]);
        checkResults(run.finalState);
        const replayed = replay(loaded.game, run.init, run.events);
        const stride = Math.max(1, Math.floor(visited.length / 10));
        // One complete event-by-event replay, as the SDK suite does; other strategies
        // compare their endpoint and sampled intermediate states without hashing gigabytes.
        if (strategy === 'fast' && count === 2)
          expect(replayed.slice(1).map(hashState)).toEqual(visited.map(hashState));
        expect(hashState(replayed.at(-1))).toBe(hashState(run.finalState));
        for (let i = 0; i < visited.length; i += stride) {
          const state = visited[i]!;
          expect(hashState(replayed[i + 1])).toBe(hashState(state));
          expect(game.phases).toContain(state.phase.id);
          expect(jsonSize(state)).toBeLessThanOrEqual(STATE_BUDGET);
          checkViews(state);
          expect(fuzzOnce(loaded.game, state, i + 1)).toEqual([]);
          const stale = loaded.game.reduce(state, {
            type: 'timer',
            now: state.phase.deadline ?? state.phase.startedAt + 1,
            phaseId: state.phase.id,
            startedAt: state.phase.startedAt - 1,
          });
          expect(stale).toEqual(state);
        }
      }
    },
    120_000,
  );

  it.each(['together', 'remote-voice', 'remote-text'] as const)(
    'plays all %s presence modes with TV and phone-only deterministic views',
    (mode) => {
      for (const phoneOnly of [false, true]) {
        const run = playGame(loaded.game, {
          players: 2,
          seed: 31,
          strategy: 'idle',
          maxSimMs: budget,
          presence: { mode, phoneOnly },
          remote: mode === 'together' ? 0 : 1,
        });
        expect(run.stuck).toBe(false);
        expect(hashState(replay(loaded.game, run.init, run.events).at(-1))).toBe(
          hashState(run.finalState),
        );
        checkViews(run.finalState);
      }
    },
  );

  it('initializes every supported player count with declared, serializable state', () => {
    for (let count = game.manifest.minPlayers; count <= game.manifest.maxPlayers; count++) {
      const state = game.init({
        players: makePlayers(count),
        settings: defaultSettingsOf(loaded.game),
        seed: count,
        now: T0,
      });
      expect(Object.keys(state.players)).toHaveLength(count);
      expect(state.phase.id).toBe('play');
      expect(state.rng).toEqual({ seed: expect.any(Number), step: expect.any(Number) });
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
      expect(game.results(state)).toBeNull();
      checkViews(state);
    }
  });
});
