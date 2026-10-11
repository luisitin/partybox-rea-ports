import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { ROUND_MS, SCORE_MS, TICK_MS } from '../server/types';
import type { State } from '../server/types';
import { DROP_MS, offsetAt } from '../server/world';
import { RESTART_MS } from '../server/types';
import { kit, place, replaceTower, T0, timeAtOffset, towerOf } from './helpers';

describe('race lifecycle', () => {
  it('starts every initial player at zero with exactly 45 seconds to build', () => {
    const state = kit.start();
    expect(state.phase).toEqual({ id: 'play', startedAt: T0, deadline: T0 + TICK_MS });
    expect(state.endsAt - state.began).toBe(45_000);
    expect(state.endsAt).toBe(T0 + ROUND_MS);
    expect(state.checked).toBe(T0);
    expect(state.towers.map((tower) => tower.id)).toEqual(['a', 'b', 'c']);
    expect(state.towers.every((tower) => tower.height === 0 && tower.best === 0)).toBe(true);
    expect(state.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(game.results(state)).toBeNull();
  });

  it('only a due timer of this phase instance updates the observation time', () => {
    const state = kit.start();
    expect(kit.timer(state, T0 + TICK_MS - 1)).toBe(state);
    for (const event of [
      { type: 'timer' as const, now: T0 + 1000, phaseId: 'score', startedAt: T0 },
      { type: 'timer' as const, now: T0 + 1000, phaseId: 'play', startedAt: T0 - 1 },
    ])
      expect(kit.reduce(state, event)).toBe(state);
    const next = kit.timer(state);
    expect(next.checked).toBe(T0 + TICK_MS);
    expect(next.phase.startedAt).toBe(T0);
    expect(next.phase.deadline).toBe(T0 + TICK_MS * 2);
    expect(kit.timer(next, T0 + TICK_MS)).toBe(next);
  });

  it('clamps a late wakeup to the race deadline and holds the reveal for six seconds', () => {
    expect(SCORE_MS).toBe(6000);
    const state = place(kit.start());
    const score = kit.timer(state, state.endsAt + 50_000);
    expect(score.phase).toEqual({
      id: 'score',
      startedAt: state.endsAt,
      deadline: state.endsAt + SCORE_MS,
    });
    expect(score.checked).toBe(state.endsAt);
    expect(score.scores).toEqual(state.scores);
    expect(score.towers).toEqual(state.towers);
    expect(game.results(score)).toBeNull();
    expect(kit.timer(score, score.phase.deadline! - 1)).toBe(score);
    const done = kit.timer(score);
    expect(done.phase.id).toBe('done');
    expect(done.phase.deadline).toBeNull();
    expect(game.results(done)?.scores).toEqual(state.scores);
    expect(kit.timer(done, done.checked + 100_000)).toBe(done);
    expect(kit.input(done, 'a', { type: 'drop', attempt: 0, level: 1 }, done.checked + 1000)).toBe(
      done,
    );
  });

  it('an input exactly at 45 seconds ends the race without awarding another floor', () => {
    const state = kit.start();
    const score = kit.input(state, 'a', { type: 'drop', attempt: 0, level: 0 }, state.endsAt);
    expect(score.phase.id).toBe('score');
    expect(score.phase.startedAt).toBe(state.endsAt);
    expect(towerOf(score).height).toBe(0);
    expect(score.scores.a).toBe(0);
  });

  it('finishes even when all players disconnect or leave permanently', () => {
    let state = place(kit.start());
    for (const id of ['a', 'b', 'c']) state = kit.player(state, id, false, 'left', T0 + 2000);
    const done = kit.timer(kit.timer(state, state.endsAt));
    expect(done.phase.id).toBe('done');
    expect(
      game
        .results(done)
        ?.ranking.map((row) => row.playerId)
        .sort(),
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('authoritative inputs', () => {
  it("places only the sender's tower and scores its best height", () => {
    const state = kit.start();
    const next = place(state, 0, 'b');
    expect(towerOf(next, 'b').height).toBe(1);
    expect(next.scores).toEqual({ a: 0, b: 1, c: 0 });
    expect(towerOf(next, 'a')).toBe(towerOf(state, 'a'));
    expect(towerOf(next, 'c')).toBe(towerOf(state, 'c'));
    expect(state.scores.b).toBe(0);
  });

  it('ignores replayed and future levels, old attempts, stale time, and premature cooldown taps', () => {
    const initial = kit.start();
    expect(kit.input(initial, 'a', { type: 'drop', attempt: 0, level: 0 }, T0 + DROP_MS - 1)).toBe(
      initial,
    );
    const first = place(initial);
    const now = timeAtOffset(towerOf(first), 0, first.course);
    for (const input of [
      { type: 'drop' as const, attempt: 0, level: 0 },
      { type: 'drop' as const, attempt: 0, level: 2 },
      { type: 'drop' as const, attempt: 1, level: 1 },
      { type: 'restart' as const, attempt: 1 },
    ])
      expect(kit.input(first, 'a', input, now)).toBe(first);
    expect(kit.input(first, 'a', { type: 'drop', attempt: 0, level: 1 }, first.checked - 1)).toBe(
      first,
    );
    expect(
      kit.input(first, 'a', { type: 'drop', attempt: 0, level: 1 }, first.checked + DROP_MS - 1),
    ).toBe(first);
    expect(place(first).scores.a).toBe(2);
  });

  it('a cooldown boundary tap is eligible, but a duplicate cannot place the next floor', () => {
    const initial = kit.start();
    const input = { type: 'drop' as const, attempt: 0, level: 0 };
    const first = kit.input(initial, 'a', input, T0 + DROP_MS);
    expect(towerOf(first).height).toBe(1);
    expect(kit.input(first, 'a', input, T0 + DROP_MS)).toBe(first);
  });

  it.each(['ghost', '', '__proto__', 'constructor', 'toString'])(
    'unknown id %j cannot act or join through an event',
    (id) => {
      const state = kit.start();
      expect(kit.input(state, id, { type: 'drop', attempt: 0, level: 0 }, T0 + 1000)).toBe(state);
      expect(kit.player(state, id, false, 'kicked', T0 + 1000)).toBe(state);
      expect(kit.player(state, id, true, undefined, T0 + 1000)).toBe(state);
      const view = game.controllerView(state, id);
      expect(view.me.role).toBe('spectator');
      expect(view.tower).toBeNull();
      expect(Object.keys(state.players)).toEqual(['a', 'b', 'c']);
    },
  );

  it('a retry retains the best score, rejects a stale attempt, and scores only a new personal best', () => {
    let state = place(place(place(kit.start())));
    const highest = towerOf(state).bestBlocks;
    state = place(state, 90);
    const crashed = towerOf(state);
    expect(crashed.crashedAt).not.toBeNull();
    expect(
      kit.input(state, 'a', { type: 'restart', attempt: 0 }, crashed.crashedAt! + RESTART_MS - 1),
    ).toBe(state);
    state = kit.input(state, 'a', { type: 'restart', attempt: 0 }, crashed.crashedAt! + RESTART_MS);
    expect(towerOf(state).attempt).toBe(1);
    expect(state.scores.a).toBe(3);
    expect(towerOf(state).bestBlocks).toEqual(highest);
    const now = timeAtOffset(towerOf(state), 0, state.course);
    expect(kit.input(state, 'a', { type: 'drop', attempt: 0, level: 0 }, now)).toBe(state);
    for (let i = 1; i <= 4; i++) {
      state = place(state);
      expect(state.scores.a).toBe(Math.max(3, i));
    }
  });

  it('refresh preserves a tower; disconnected input is ignored and reconnect can keep building', () => {
    const before = place(kit.start());
    const disconnected = kit.player(before, 'a', false, undefined, before.checked + 1);
    expect(towerOf(disconnected)).toBe(towerOf(before));
    expect(place(disconnected)).toBe(disconnected);
    expect(game.controllerView(disconnected, 'a').tower).toEqual(towerOf(before));
    const back = kit.player(disconnected, 'a', true, undefined, before.checked + 100);
    expect(towerOf(back)).toBe(towerOf(before));
    expect(place(back).scores.a).toBe(2);
  });
});

describe('pause and VIP actions', () => {
  it('freezes inputs and timers, then shifts every race clock once on resume', () => {
    let state = kit.start();
    state = replaceTower(state, {
      ...towerOf(state),
      movingSince: T0 + 200,
      lastAt: T0 + 300,
      crashedAt: T0 + 700,
    });
    state = { ...state, checked: T0 + 900 };
    const pausedAt = T0 + 1000;
    const resumedAt = T0 + 6000;
    const paused = kit.vip(state, 'pause', pausedAt);
    expect(kit.vip(paused, 'pause', pausedAt + 100)).toBe(paused);
    expect(kit.timer(paused, state.endsAt + 1000)).toBe(paused);
    expect(kit.input(paused, 'b', { type: 'drop', attempt: 0, level: 0 }, pausedAt + 1000)).toBe(
      paused,
    );
    const after = kit.vip(paused, 'resume', resumedAt);
    expect(after.phase.paused).toBeUndefined();
    expect(after.phase.startedAt).toBe(state.phase.startedAt);
    expect(after.phase.deadline).toBe(state.phase.deadline! + 5000);
    expect(after.began).toBe(state.began + 5000);
    expect(after.endsAt).toBe(state.endsAt + 5000);
    expect(after.checked).toBe(state.checked + 5000);
    for (const before of state.towers) {
      const tower = towerOf(after, before.id);
      expect(tower.movingSince).toBe(before.movingSince + 5000);
      expect(tower.lastAt).toBe(before.lastAt + 5000);
      expect(tower.crashedAt).toBe(before.crashedAt === null ? null : before.crashedAt + 5000);
      expect(offsetAt(tower, resumedAt, state.course)).toBe(
        offsetAt(before, pausedAt, state.course),
      );
    }
    expect(kit.vip(after, 'resume', resumedAt + 100)).toBe(after);
  });

  it('skip while paused resumes clocks before freezing the race; end goes straight to results', () => {
    const state = place(kit.start());
    const paused = kit.vip(state, 'pause', T0 + 2000);
    const skipped = kit.vip(paused, 'skip', T0 + 7000);
    expect(skipped.phase.id).toBe('score');
    expect(skipped.phase.paused).toBeUndefined();
    expect(skipped.began).toBe(T0 + 5000);
    expect(skipped.endsAt).toBe(state.endsAt + 5000);
    expect(skipped.checked - skipped.began).toBe(2000);
    expect(skipped.scores).toEqual(state.scores);
    expect(kit.vip(skipped, 'skip', T0 + 7100).phase.id).toBe('done');
    expect(kit.vip(paused, 'end', T0 + 7000).phase.id).toBe('done');
  });

  it('pausing the reveal extends only its deadline and does not change completed towers', () => {
    const score = kit.vip(place(kit.start()), 'skip', T0 + 2000);
    const resumed = kit.vip(kit.vip(score, 'pause', T0 + 2500), 'resume', T0 + 6500);
    expect(resumed.phase.deadline).toBe(score.phase.deadline! + 4000);
    expect(resumed.began).toBe(score.began);
    expect(resumed.endsAt).toBe(score.endsAt);
    expect(resumed.towers).toEqual(score.towers);
  });
});

describe('standings and public projections', () => {
  it('height ties share first place and retain every original player, including one who left', () => {
    let state: State = { ...kit.start(), scores: { a: 8, b: 8, c: 2 } };
    state = kit.player(state, 'a', false, 'left', T0 + 1000);
    const done = kit.vip(state, 'end', T0 + 2000);
    expect(game.results(done)).toMatchObject({
      scores: { a: 8, b: 8, c: 2 },
      winnerIds: ['a', 'b'],
      ranking: [
        { playerId: 'a', score: 8, rank: 1 },
        { playerId: 'b', score: 8, rank: 1 },
        { playerId: 'c', score: 2, rank: 3 },
      ],
    });
    expect(game.controllerView(done, 'b').rank).toBe(1);
    expect(game.controllerView(done, 'c').rank).toBe(3);
    expect(game.controllerView(done, 'ghost').rank).toBeNull();
  });

  it('the TV exposes all towers; a TV phone receives its own timing stage without internal rng', () => {
    const state = place(kit.start());
    const changed = { ...state, rng: { seed: 987_654_321, step: 123_456 } };
    expect(game.tvView(state).towers).toEqual(state.towers);
    expect(game.tvView(changed)).toEqual(game.tvView(state));
    expect(game.tvView(state)).not.toHaveProperty('rng');
    for (const id of ['a', 'b', 'c', 'ghost', '__proto__']) {
      expect(game.controllerView(changed, id)).toEqual(game.controllerView(state, id));
      expect(game.controllerView(state, id)).not.toHaveProperty('rng');
    }
    expect(game.controllerView(state, 'a').tower).toEqual(towerOf(state));
    expect(game.controllerView(state, 'b').towers).toBeUndefined();
  });

  it('phone-only rooms include the full stage for players and spectators, without giving a spectator a tower', () => {
    const state = kit.start({ presence: { mode: 'together', phoneOnly: true } });
    for (const id of ['a', 'b', 'ghost']) {
      expect(game.controllerView(state, id).stage).toBe(true);
      expect(game.controllerView(state, id).towers).toEqual(state.towers);
    }
    expect(game.controllerView(state, 'ghost').tower).toBeNull();
    const tvRoom = kit.start();
    const remote = {
      ...tvRoom,
      players: { ...tvRoom.players, a: { ...tvRoom.players.a!, canSeeTv: false } },
    };
    expect(game.controllerView(remote, 'a').stage).toBe(true);
    expect(game.controllerView(remote, 'a').towers).toEqual(remote.towers);
    expect(game.controllerView(remote, 'b').stage).toBe(false);
  });
});
