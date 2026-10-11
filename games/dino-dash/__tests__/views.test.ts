import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { distanceAt, visibleCourse } from '../server/world';
import { T0, kit, safe } from './helpers';

describe('public race views', () => {
  it('never sends the future course, rng or settings, even to spectators', () => {
    const s = kit.start();
    const views = [
      game.tvView(s),
      ...['p1', 'p2', 'spectator', '__proto__'].map((id) => game.controllerView(s, id)),
    ];
    for (const view of views) {
      expect(view.obstacles).toEqual(visibleCourse(s.world));
      expect(view.obstacles.length).toBeLessThan(s.world.course.length);
      expect(view).not.toHaveProperty('course');
      expect(view).not.toHaveProperty('rng');
      expect(view).not.toHaveProperty('settings');
      expect(JSON.stringify(view)).not.toContain(JSON.stringify(s.world.course.at(-1)));
    }
  });

  it('changing unrevealed obstacles cannot change any player or TV view', () => {
    const s = kit.timer(kit.start(), T0 + 2300);
    const visibleIds = new Set(visibleCourse(s.world).map((o) => o.id));
    expect(visibleIds.size).toBeGreaterThan(0);
    const changed = {
      ...s,
      world: {
        ...s.world,
        course: s.world.course.map((o) =>
          !visibleIds.has(o.id)
            ? { ...o, kind: 'bird' as const, id: o.id + 1_000_000, width: 99 }
            : o,
        ),
      },
    };
    expect(game.tvView(changed)).toEqual(game.tvView(s));
    for (const id of ['p1', 'p2', 'spectator'])
      expect(game.controllerView(changed, id)).toEqual(game.controllerView(s, id));
  });

  it('sends identical public race data while own pose and slot remain player-specific', () => {
    const s = kit.input(safe(), 'p1', { type: 'duck', down: true }, T0 + 100);
    const a = game.controllerView(s, 'p1');
    const b = game.controllerView(s, 'p2');
    expect(a.runners).toEqual(b.runners);
    expect(a.obstacles).toEqual(b.obstacles);
    expect([a.slot, b.slot]).toEqual([0, 1]);
    expect([a.duck, b.duck]).toEqual([true, false]);
    expect(game.tvView(s).runners).toEqual(a.runners);
    expect(a.distance).toBe(Math.floor(distanceAt(100) / 10));
  });

  it('phone-only and remote phones receive a stage, unknown viewers remain spectators', () => {
    const s = kit.start({ presence: { mode: 'remote-voice', phoneOnly: true } });
    expect(game.controllerView(s, 'p1').stage).toBe(true);
    expect(game.controllerView(s, 'spectator').stage).toBe(true);
    const tv = kit.start();
    expect(game.controllerView(tv, 'p1').stage).toBe(false);
    const remote = {
      ...tv,
      players: { ...tv.players, p1: { ...tv.players.p1!, canSeeTv: false } },
    };
    expect(game.controllerView(remote, 'p1').stage).toBe(true);
    for (const id of ['spectator', '__proto__', 'constructor', '']) {
      const cv = game.controllerView(tv, id);
      expect(cv.me.role).toBe('spectator');
      expect(cv.slot).toBe(-1);
      expect(cv.alive).toBe(false);
      expect(cv.duck).toBe(false);
      expect(cv.distance).toBe(0);
      expect(cv.rank).toBeNull();
    }
  });

  it('crashed players wait and final rank reflects all tied totals', () => {
    const s = kit.start();
    const crash = {
      ...s,
      world: {
        ...s.world,
        runners: s.world.runners.map((r, i) => (i === 0 ? { ...r, died: 100, distance: 36 } : r)),
      },
    };
    expect(game.controllerView(crash, 'p1').players.find((p) => p.id === 'p1')?.status).toBe(
      'waiting',
    );
    expect(game.controllerView(crash, 'p2').players.find((p) => p.id === 'p2')?.status).toBe(
      'active',
    );
    const done = kit.vip({ ...crash, scores: { p1: 50, p2: 50, p3: 30 } }, 'end', T0);
    expect(game.controllerView(done, 'p3').rank).toBe(3);
  });
});
