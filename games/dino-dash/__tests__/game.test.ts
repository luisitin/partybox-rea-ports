// Concrete collisions and elapsed-time examples pin the published game rules.
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { roundPoints } from '../server/scoring';
import { SCORE_MS } from '../server/types';
import { allDead, apply, collides, distanceAt, heightAt, speedAt, tick } from '../server/world';
import { T0, freeze, kit, obstacle, runner, safe, world } from './helpers';

describe('run physics', () => {
  it('integrates the speed ramp, then caps it without a distance discontinuity', () => {
    expect(speedAt(-10)).toBe(360);
    expect(speedAt(60_000)).toBe(576);
    expect(speedAt(200_000)).toBe(780);
    expect(distanceAt(-10)).toBe(0);
    expect(distanceAt(1000)).toBeCloseTo(361.8, 8);
    expect(distanceAt(60_000)).toBe(28_080);
    expect(distanceAt(200_000)).toBeCloseTo(131_500, 6);
    expect(distanceAt(200_001) - distanceAt(200_000)).toBeCloseTo(0.78, 6);
  });

  it('a tap has one fixed parabola, lands at 700ms and cannot stack midair', () => {
    const jumped = apply(world([runner('a')]), 'a', { type: 'jump' }, 100);
    const a = jumped.runners[0]!;
    expect(heightAt(a, 100)).toBe(0);
    expect(heightAt(a, 450)).toBeCloseTo(110.25, 8);
    expect(heightAt(a, 800)).toBe(0);
    expect(apply(jumped, 'a', { type: 'jump' }, 100)).toBe(jumped);
    expect(apply(jumped, 'a', { type: 'jump' }, 450)).toBe(jumped);
    expect(apply(jumped, 'a', { type: 'jump' }, 801).runners[0]?.jumpAt).toBe(801);
  });

  it('a grounded runner crashes on a rock, while a timely jump clears it', () => {
    const course = [obstacle('rock')];
    const grounded = tick(world([runner('a')], course), 1400);
    expect(grounded.runners[0]?.died).toBe(920);
    const jumped = apply(world([runner('a')], course), 'a', { type: 'jump' }, 750);
    expect(tick(jumped, 1400).runners[0]?.died).toBeNull();
  });

  it('standing hits a bird, a grounded duck passes under it', () => {
    const course = [obstacle('bird')];
    expect(tick(world([runner('a')], course), 1400).runners[0]?.died).toBe(920);
    const ducked = apply(world([runner('a')], course), 'a', { type: 'duck', down: true }, 700);
    expect(tick(ducked, 1400).runners[0]?.died).toBeNull();
    expect(collides(runner('a', { jumpAt: 950, duck: true }), course[0]!, 1000)).toBe(true);
  });

  it('jumping preserves a physical hold; airborne body stays tall and landing crouches', () => {
    const held = world([runner('a', { duck: true })]);
    const jumped = apply(held, 'a', { type: 'jump' }, 100);
    expect(jumped.runners[0]?.duck).toBe(true);
    const bird = obstacle('bird', 180);
    expect(collides(jumped.runners[0]!, bird, 200)).toBe(true);
    const landed = tick(jumped, 800);
    expect(landed.runners[0]?.jumpAt).toBeNull();
    expect(landed.runners[0]?.duck).toBe(true);
  });

  it('strict box edges are safe, and crouching does not clear rocks', () => {
    expect(collides(runner('a'), obstacle('rock', 110), 0)).toBe(false);
    expect(collides(runner('a'), obstacle('rock', 50), 0)).toBe(false);
    expect(collides(runner('a'), obstacle('rock', 109.9), 0)).toBe(true);
    expect(collides(runner('a', { duck: true }), obstacle('rock', 90), 0)).toBe(true);
  });

  it('death freezes distance and pose while other lanes keep running', () => {
    const start = world([runner('a'), runner('b', { jumpAt: 750 })], [obstacle('rock')]);
    const crashed = tick(start, 1400);
    const later = tick(crashed, 3000);
    expect(later.runners[0]).toEqual(crashed.runners[0]);
    expect(later.runners[1]?.distance).toBeCloseTo(1096.2, 6);
    expect(apply(later, 'a', { type: 'jump' }, 3000)).toBe(later);
  });

  it('judging is monotonic, idempotent and identical across delayed delivery', () => {
    const start = world([runner('a'), runner('b')], [obstacle('rock')]);
    const once = tick(start, 5000);
    expect(tick(once, 5000)).toBe(once);
    expect(tick(once, 100)).toBe(once);
    expect(tick(tick(tick(start, 200), 600), 5000)).toEqual(once);
    expect(once.checked).toBe(920);
  });

  it('release works after the action budget; unknown and stale inputs do nothing', () => {
    const full = world([runner('a', { changes: 600, duck: true })]);
    expect(apply(full, 'a', { type: 'jump' }, 0)).toBe(full);
    expect(apply(full, 'a', { type: 'duck', down: false }, 0).runners[0]?.duck).toBe(false);
    expect(apply(full, 'ghost', { type: 'jump' }, 0)).toBe(full);
    const checked = tick(world([runner('a')]), 1000);
    expect(apply(checked, 'a', { type: 'jump' }, 999)).toBe(checked);
  });
});

describe('match state machine', () => {
  it('starts every lane on the same course with a 60s cap and a 100ms deadline', () => {
    const s = kit.start();
    expect(s.phase).toEqual({ id: 'play', startedAt: T0, deadline: T0 + 100 });
    expect(s.endsAt).toBe(T0 + 60_000);
    expect(s.world.runners.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(s.world.runners.every((r) => r.died === null && r.distance === 0)).toBe(true);
    expect(game.results(s)).toBeNull();
  });

  it('ignores early timers, stale phase instances and already-fired deadlines', () => {
    const s = safe();
    expect(kit.timer(s, T0 + 99)).toBe(s);
    expect(game.reduce(s, { type: 'timer', now: T0 + 100, phaseId: 'score', startedAt: T0 })).toBe(
      s,
    );
    expect(
      game.reduce(s, { type: 'timer', now: T0 + 100, phaseId: 'play', startedAt: T0 - 1 }),
    ).toBe(s);
    const stepped = kit.timer(s);
    expect(stepped.phase.deadline).toBe(T0 + 200);
    expect(kit.timer(stepped, T0 + 100)).toBe(stepped);
  });

  it('late input settles collisions before acting, so a delayed jump cannot save a crash', () => {
    const s = { ...kit.start(), world: world([runner('p1'), runner('p2')], [obstacle('rock')]) };
    const jumped = kit.input(s, 'p1', { type: 'jump' }, T0 + 1500);
    expect(jumped.phase.id).toBe('score');
    expect(jumped.world.runners[0]?.jumpAt).toBeNull();
    expect(jumped.world.runners[0]?.died).toBe(920);
    expect(jumped.scores.p1).toBe(33);
  });

  it('a late timer checks every collision sample instead of tunnelling through a rock', () => {
    const s = { ...kit.start(), world: world([runner('p1'), runner('p2')], [obstacle('rock')]) };
    const next = kit.timer(s, T0 + 60_000);
    expect(next.phase.id).toBe('score');
    expect(next.world.checked).toBe(920);
    expect(next.world.runners.map((r) => r.died)).toEqual([920, 920]);
  });

  it('all dead ends a round, but one survivor keeps earning metres', () => {
    const s = safe();
    const lone = { ...s, world: world([runner('p1', { died: 100, distance: 36 }), runner('p2')]) };
    const running = kit.timer(lone, T0 + 3000);
    expect(running.phase.id).toBe('play');
    expect(running.world.runners[1]?.distance).toBeCloseTo(1096.2, 6);
    expect(allDead(running.world)).toBe(false);
    const dead = {
      ...lone,
      world: world([runner('p1', { died: 100 }), runner('p2', { died: 100 })]),
    };
    expect(kit.timer(dead).phase.id).toBe('score');
  });

  it('the cap ties survivors, adds whole metres once, and ends the final round', () => {
    const s = safe(kit.start({ settings: { rounds: 1 } }));
    const score = kit.timer(s, s.endsAt);
    expect(score.phase.id).toBe('score');
    expect(score.phase.deadline).toBe(s.endsAt + SCORE_MS);
    expect(score.lastPoints).toEqual({ p1: 2808, p2: 2808, p3: 2808 });
    expect(score.scores).toEqual(score.lastPoints);
    expect(kit.input(score, 'p1', { type: 'jump' })).toBe(score);
    const done = kit.timer(score);
    expect(done.phase.id).toBe('done');
    expect(done.scores).toEqual(score.scores);
    expect(game.results(done)?.winnerIds).toEqual(['p1', 'p2', 'p3']);
    expect(game.results(done)?.ranking.map((r) => r.rank)).toEqual([1, 1, 1]);
    expect(kit.timer(done)).toBe(done);
    expect(kit.vip(done, 'end').scores).toEqual(done.scores);
  });

  it('floors distance rather than survival rank; tied distances earn equal points', () => {
    expect(
      roundPoints(
        world([
          runner('a', { distance: 129.99, died: 400 }),
          runner('b', { distance: 129.99, died: 400 }),
          runner('c', { distance: 250 }),
        ]),
      ),
    ).toEqual({ a: 12, b: 12, c: 25 });
  });

  it('starts a fresh next course while preserving cumulative scores', () => {
    const scored = kit.vip(safe(), 'skip', T0 + 2000);
    const next = kit.timer(scored);
    expect(next.phase.id).toBe('play');
    expect(next.round).toBe(2);
    expect(next.scores).toEqual({ p1: 72, p2: 72, p3: 72 });
    expect(next.world.runners.every((r) => r.distance === 0 && r.died === null)).toBe(true);
    expect(next.world.course).not.toEqual(scored.world.course);
  });

  it('a second run adds its distance to the first run rather than replacing totals', () => {
    const first = kit.vip(safe(), 'skip', T0 + 2000);
    const second = safe(kit.timer(first));
    const scored = kit.vip(second, 'skip', second.began + 1000);
    expect(scored.lastPoints).toEqual({ p1: 36, p2: 36, p3: 36 });
    expect(scored.scores).toEqual({ p1: 108, p2: 108, p3: 108 });
  });

  it('VIP end credits the current run once and preserves already-scored totals', () => {
    const ended = kit.vip(safe(), 'end', T0 + 1000);
    expect(ended.phase.id).toBe('done');
    expect(ended.scores).toEqual({ p1: 36, p2: 36, p3: 36 });
    const scored = kit.vip(safe(), 'skip', T0 + 1000);
    expect(kit.vip(scored, 'end', T0 + 2000).scores).toEqual(scored.scores);
  });

  it('pause freezes input/timers and resume shifts every run clock by the paused interval', () => {
    const paused = kit.vip(safe(), 'pause', T0 + 1000);
    expect(paused.world.checked).toBe(1000);
    expect(kit.input(paused, 'p1', { type: 'jump' }, T0 + 5000)).toBe(paused);
    expect(kit.timer(paused, T0 + 5000)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', T0 + 6000);
    expect(resumed.began).toBe(T0 + 5000);
    expect(resumed.endsAt).toBe(T0 + 65_000);
    expect(resumed.phase.deadline).toBe((paused.phase.deadline ?? 0) + 5000);
    expect(resumed.world).toEqual(paused.world);
    expect(kit.timer(resumed, T0 + 6100).world.checked).toBe(1100);
  });

  it('skip and end while paused score frozen progress, never the pause duration', () => {
    const paused = kit.vip(safe(), 'pause', T0 + 1000);
    const skipped = kit.vip(paused, 'skip', T0 + 31_000);
    expect(skipped.phase.id).toBe('score');
    expect(skipped.world.checked).toBe(1000);
    expect(skipped.scores).toEqual({ p1: 36, p2: 36, p3: 36 });
    expect(kit.vip(paused, 'end', T0 + 31_000).scores).toEqual(skipped.scores);
  });

  it('disconnect releases a hold, rejects input, and reconnect resumes the same runner', () => {
    const held = kit.input(safe(), 'p1', { type: 'duck', down: true }, T0 + 100);
    const dropped = kit.player(held, 'p1', false, undefined, T0 + 200);
    expect(dropped.world.runners[0]?.duck).toBe(false);
    expect(kit.input(dropped, 'p1', { type: 'jump' }, T0 + 300)).toBe(dropped);
    const moved = kit.timer(dropped, T0 + 1000);
    const returned = kit.player(moved, 'p1', true, undefined, T0 + 1000);
    expect(returned.world.runners[0]).toEqual(moved.world.runners[0]);
    expect(kit.input(returned, 'p1', { type: 'jump' }, T0 + 1000).world.runners[0]?.jumpAt).toBe(
      1000,
    );
  });

  it('a pointer release during pause clears duck without advancing the frozen run', () => {
    const held = kit.input(safe(), 'p1', { type: 'duck', down: true }, T0 + 100);
    const paused = kit.vip(held, 'pause', T0 + 200);
    const released = kit.input(paused, 'p1', { type: 'duck', down: false }, T0 + 1200);
    expect(released.world.checked).toBe(paused.world.checked);
    expect(released.world.runners[0]?.duck).toBe(false);
    expect(released.world.runners[0]?.distance).toBe(paused.world.runners[0]?.distance);
    expect(kit.vip(released, 'resume', T0 + 2200).world.runners[0]?.duck).toBe(false);
    expect(kit.input(paused, 'p1', { type: 'duck', down: true }, T0 + 1200)).toBe(paused);
  });

  it('disconnected rooms still terminate and retain permanently departed players in results', () => {
    let s = kit.start({ settings: { rounds: 1 } });
    for (const id of Object.keys(s.players)) s = kit.player(s, id, false, 'left', T0);
    s = kit.until(s, 'done', 1000);
    expect(game.results(s)?.ranking.map((r) => r.playerId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('a permanent departure preserves its lane and total while later rounds award it zero', () => {
    const departed = kit.player(safe(), 'p2', false, 'left', T0 + 1000);
    expect(departed.left).toEqual(['p2']);
    expect(departed.world.runners[1]?.died).toBe(1000);
    const first = kit.vip(departed, 'skip', T0 + 2000);
    expect(first.scores).toEqual({ p1: 72, p2: 36, p3: 72 });
    const next = safe(kit.timer(first));
    expect(next.world.runners.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(next.world.runners[1]?.died).toBe(0);
    expect(next.world.runners[1]?.distance).toBe(0);
    expect(game.controllerView(next, 'p3').slot).toBe(2);
    const scored = kit.timer(next, next.endsAt);
    expect(scored.lastPoints.p2).toBe(0);
    expect(scored.scores.p2).toBe(36);
    expect(game.results(kit.timer(scored))?.scores.p2).toBe(36);
  });

  it('spectator, prototype names, stale input and wrong-phase inputs never act', () => {
    const s = safe();
    for (const id of ['spectator', '__proto__', 'constructor', '']) {
      expect(kit.input(s, id, { type: 'jump' }, T0 + 500)).toBe(s);
      expect(kit.player(s, id, false, undefined, T0 + 500)).toBe(s);
    }
    const moved = kit.timer(s, T0 + 1000);
    expect(kit.input(moved, 'p1', { type: 'jump' }, T0 + 900)).toBe(moved);
    const scored = kit.vip(moved, 'skip', T0 + 1000);
    expect(kit.input(scored, 'p1', { type: 'duck', down: true })).toBe(scored);
    expect(kit.input(kit.vip(scored, 'end'), 'p1', { type: 'jump' }).phase.id).toBe('done');
  });

  it('reduces frozen state without mutation and replays identical events byte for byte', () => {
    const s = freeze(safe());
    const before = JSON.stringify(s);
    const event = {
      type: 'input',
      playerId: 'p1',
      input: { type: 'jump' },
      now: T0 + 500,
    } as const;
    expect(game.reduce(s, event)).toEqual(game.reduce(s, event));
    expect(JSON.stringify(s)).toBe(before);
    const jumped = game.reduce(s, event);
    expect(jumped.world.runners[1]).toEqual({ ...s.world.runners[1], distance: 180.45 });
    expect(jumped.rng).toEqual(s.rng);
  });
});
