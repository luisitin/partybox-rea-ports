// Exercise the real SDK wrapper for this game; catalog-wide pool quotas do not apply here.
import { describe, expect, it } from 'vitest';
import { minigameStart, minigameReduce, minigameTv, minigameController } from '@partybox/game-sdk';
import type { MinigameMode } from '@partybox/game-sdk';
import { testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { State } from '../server/types';

function drive(mode: MinigameMode) {
  const players = testPlayers(mode === 'duel' ? 2 : 4, { bots: mode === 'duel' ? 2 : 4 });
  const teams = mode === 'duel' ? players.map((p) => [p.id]) : [];
  let state = minigameStart(game, { players, mode, teams, seed: 11, now: 1_000_000, help: true });
  let playMs = 0;
  let now = 1_000_000;
  let enteredGame = false;
  for (let step = 0; step < 4000 && state.stage !== 'done'; step++) {
    expect(state.phase.deadline).not.toBeNull();
    now = Math.max(now, state.phase.deadline!);
    const before = state;
    state = minigameReduce(game, state, {
      type: 'timer',
      now,
      phaseId: state.phase.id,
      startedAt: state.phase.startedAt,
    });
    if (state.inner) {
      enteredGame = true;
      expect((state.inner as State).settings.quizMode).toBe('wager');
    }
    if (before.stage === 'play' && state.stage !== 'play') playMs = now - before.playStartedAt!;
    expect(JSON.stringify(state).length).toBeLessThan(256 * 1024);
    expect(() => minigameTv(game, state)).not.toThrow();
    for (const p of players) expect(() => minigameController(game, state, p.id)).not.toThrow();
  }
  expect(enteredGame).toBe(true);
  expect(state.stage).toBe('done');
  expect(state.broken).toBe(false);
  expect(state.result?.ranking).toHaveLength(players.length);
  expect(state.result?.ranking.every((row) => Number.isFinite(row.score))).toBe(true);
  // SDK permits play through seconds×1.3, then a separate 1.5s finish and 6s result.
  // The global suite's cap assertion counts those post-play beats as gameplay.
  const cap = game.manifest.minigame!.seconds * 1300;
  expect(playMs).toBeLessThanOrEqual(cap + 1);
  expect(now - state.playStartedAt!).toBeLessThanOrEqual(cap + 7501);
  return state;
}
describe('preserved SDK minigame integration', () => {
  it.each(['ffa', 'duel'] as const)(
    '%s reaches complete deterministic ranked results within its play cap',
    (mode) => {
      expect(game.manifest.minigame!.seconds).toBe(100);
      expect(drive(mode)).toEqual(drive(mode));
    },
  );
});
