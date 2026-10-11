import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { ROUND_MS } from '../server/types';
import { boardState, first, kit, playing } from './helpers';

describe('match lifecycle', () => {
  it('starts every player with the identical piece and a two-minute clock', () => {
    const state = playing(8, 79);
    expect(state.phase.id).toBe('play');
    expect(state.endsAt - state.began).toBe(120_000);
    expect(state.boards).toHaveLength(8);
    expect(new Set(state.boards.map((b) => b.active!.kind)).size).toBe(1);
    expect(state.boards.every((b) => b.grid.flat().every((c) => c === 0))).toBe(true);
    expect(game.results(state)).toBeNull();
  });

  it('reveals scores at the round cap and finishes after the results beat', () => {
    let state = playing();
    state = kit.timer(state, state.endsAt);
    expect(state.phase.id).toBe('score');
    expect(state.checked - state.began).toBeLessThanOrEqual(ROUND_MS);
    state = kit.timer(state);
    expect(state.phase.id).toBe('done');
    const result = game.results(state)!;
    expect(result.ranking.map((r) => r.playerId).sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(result.winnerIds.length).toBeGreaterThan(0);
    expect(kit.timer(state)).toEqual(state);
  });

  it('ends play with one surviving board, and ignores dead-player controls', () => {
    const start = playing();
    const state = {
      ...start,
      boards: start.boards.map((b, i) =>
        i === 0 ? b : { ...b, alive: false, active: null, diedAt: start.began },
      ),
    };
    expect(kit.input(state, 'p2', { type: 'drop' }).boards[1]).toEqual(state.boards[1]);
    expect(kit.timer(state).phase.id).toBe('score');
  });

  it('rejects stale timers, early timers and inputs from spectators', () => {
    const state = playing();
    expect(
      game.reduce(state, {
        type: 'timer',
        now: state.phase.deadline!,
        phaseId: 'play',
        startedAt: state.phase.startedAt - 1,
      }),
    ).toEqual(state);
    expect(kit.timer(state, state.phase.startedAt + 1)).toEqual(state);
    expect(kit.input(state, 'spectator', { type: 'drop' }).boards.map((b) => b.grid)).toEqual(
      state.boards.map((b) => b.grid),
    );
  });

  it('pause blocks controls, then resume preserves remaining round time', () => {
    const start = playing();
    let state = kit.vip(start, 'pause', start.began + 1000);
    expect(kit.input(state, 'p1', { type: 'drop' }, start.began + 2000)).toEqual(state);
    expect(kit.timer(state, start.began + 3000)).toEqual(state);
    state = kit.vip(state, 'resume', start.began + 6000);
    expect(state.endsAt).toBe(start.endsAt + 5000);
    expect(state.phase.paused).toBeUndefined();
  });

  it('VIP skip advances play/results and VIP end produces finite scores', () => {
    const score = kit.vip(playing(), 'skip');
    expect(score.phase.id).toBe('score');
    expect(kit.vip(score, 'skip').phase.id).toBe('done');
    const result = game.results(kit.vip(playing(), 'end'))!;
    expect(Object.values(result.scores).every(Number.isFinite)).toBe(true);
  });

  it('a temporary disconnect preserves the board and reconnect restores the same stack', () => {
    const start = kit.input(playing(), 'p1', { type: 'drop' });
    const dropped = kit.player(start, 'p1', false, undefined, start.began + 600);
    expect(first(dropped).grid).toEqual(first(start).grid);
    expect(first(dropped).alive).toBe(true);
    const rejoined = kit.player(dropped, 'p1', true, undefined, start.began + 700);
    expect(first(rejoined).grid).toEqual(first(start).grid);
    expect(rejoined.players.p1!.connected).toBe(true);
    expect(kit.until(dropped, 'done', 1000).phase.id).toBe('done');
  });

  it('permanent departure eliminates the seat without erasing its final score', () => {
    const state = boardState({ score: 310, lines: 2 });
    const left = kit.player(state, 'p1', false, 'left');
    expect(first(left).alive).toBe(false);
    expect(first(left).score).toBe(310);
    expect(game.results(kit.vip(left, 'end'))!.scores.p1).toBeDefined();
  });
});

describe('view privacy', () => {
  it('never exposes future-sequence indices or plans and reserves hold/preview for the owner', () => {
    const start = playing();
    const state = {
      ...start,
      boards: start.boards.map((b, i) => ({
        ...b,
        hold: i === 0 ? ('I' as const) : ('Z' as const),
        plan: { x: 7, rotation: 2 as const },
      })),
    };
    const tv = game.tvView(state);
    expect(tv.boards.every((b) => !('hold' in b) && !('sequence' in b) && !('plan' in b))).toBe(
      true,
    );
    expect(game.controllerView(state, 'p1').hold).toBe('I');
    expect(game.controllerView(state, 'p2').hold).toBe('Z');
    const changed = {
      ...state,
      boards: state.boards.map((b, i) =>
        i === 1 ? { ...b, hold: 'L' as const, sequence: 99, plan: null } : b,
      ),
    };
    expect(game.controllerView(changed, 'p1')).toEqual(game.controllerView(state, 'p1'));
    expect(game.tvView(changed)).toEqual(tv);
    expect(game.controllerView(state, 'spectator').next).toEqual([]);
    expect(game.controllerView(state, 'spectator').hold).toBeNull();
  });
});
