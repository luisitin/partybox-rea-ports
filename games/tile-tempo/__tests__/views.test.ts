// Hidden-information tests change the unrevealed course while public race facts remain equal.
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import type { State } from '../server/types';
import { kit, miss, startPlay, tap } from './helpers';

describe('private note windows and public race views', () => {
  it('TV never receives notes, the full course or the PRNG', () => {
    for (const state of [
      kit.start(),
      startPlay(),
      kit.vip(startPlay(), 'skip'),
      kit.vip(startPlay(), 'end'),
    ]) {
      const view = game.tvView(state);
      expect(view).not.toHaveProperty('sequence');
      expect(view).not.toHaveProperty('notes');
      expect(view).not.toHaveProperty('rng');
      expect(JSON.stringify(view)).not.toContain(JSON.stringify(state.sequence));
      const different = {
        ...state,
        sequence: state.sequence.map((n) => (n + 1) % 4),
        rng: { seed: 901, step: 22 },
      };
      expect(game.tvView(different)).toEqual(view);
    }
  });

  it('each phone receives exactly its own next four rows and no unrevealed suffix', () => {
    const before = startPlay();
    const state: State = {
      ...before,
      sequence: [0, 1, 2, 3, 3, 2, 1, 0, 2, 2, 1, 1, ...before.sequence.slice(12)],
      runs: {
        ...before.runs,
        p1: { ...before.runs.p1!, tiles: 5 },
        p2: { ...before.runs.p2!, tiles: 2 },
      },
    };
    expect(game.controllerView(state, 'p1').notes).toEqual([2, 1, 0, 2]);
    expect(game.controllerView(state, 'p2').notes).toEqual([2, 3, 3, 2]);
    for (const id of Object.keys(state.players)) {
      const view = game.controllerView(state, id);
      expect(view.row).toBe(state.runs[id]!.tiles);
      expect(view).not.toHaveProperty('sequence');
      expect(view).not.toHaveProperty('rng');
      const start = state.runs[id]!.tiles;
      const different: State = {
        ...state,
        rng: { seed: 0, step: 9999 },
        sequence: state.sequence.map((n, i) => (i >= start && i < start + 4 ? n : (n + 1) % 4)),
      };
      expect(game.controllerView(different, id)).toEqual(view);
    }
  });

  it('spectators and eliminated players receive no note targets', () => {
    const state = miss(startPlay());
    for (const id of ['spectator', '', '__proto__', 'p1']) {
      const view = game.controllerView(state, id);
      expect(view.notes).toEqual([]);
      expect(view.alive).toBe(false);
      const changed = { ...state, sequence: state.sequence.map((n) => (n + 1) % 4) };
      expect(game.controllerView(changed, id)).toEqual(view);
    }
    for (const phase of ['skip', 'end'] as const)
      expect(game.controllerView(kit.vip(state, phase), 'p2').notes).toEqual([]);
  });

  it('phone-only and remote players get a stage without expanding their note windows', () => {
    const players = Object.values(startPlay().players);
    const state = kit.start({ players, presence: { mode: 'remote-text', phoneOnly: true } });
    for (const id of [...Object.keys(state.players), 'spectator']) {
      expect(game.controllerView(state, id).phoneStage).toBe(true);
      expect(game.controllerView(state, id).notes.length).toBeLessThanOrEqual(4);
    }
    const tv = startPlay();
    expect(game.controllerView(tv, 'p1').phoneStage).toBe(false);
    const remote = {
      ...tv,
      players: { ...tv.players, p1: { ...tv.players.p1!, canSeeTv: false } },
    };
    expect(game.controllerView(remote, 'p1').phoneStage).toBe(true);
    expect(game.controllerView(remote, 'p2').phoneStage).toBe(false);
  });

  it('counts and finite speed are public, ties share a rank and eliminated speed freezes', () => {
    let state = tap(startPlay(), 'p1');
    const running = game.tvView(state).standings.find((p) => p.id === 'p1')!;
    expect(running).toMatchObject({ tiles: 1, speed: 10, out: false, rank: 1 });
    expect(game.tvView(state).standings.find((p) => p.id === 'p2')?.rank).toBe(2);
    state = miss(state, 'p1');
    const stopped = game.tvView(state).standings.find((p) => p.id === 'p1')!;
    expect(stopped).toMatchObject({ tiles: 1, speed: 5, out: true });
    state = kit.timer(state, state.began + 1000);
    expect(game.tvView(state).standings.find((p) => p.id === 'p1')?.speed).toBe(stopped.speed);
    for (const row of game.tvView(state).standings) expect(Number.isFinite(row.speed)).toBe(true);
    expect(game.controllerView(state, 'p2').standings).toEqual(game.tvView(state).standings);
  });
});
