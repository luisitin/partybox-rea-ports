import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { botInput } from '../server/bot';
import { credit } from '../server/scoring';
import { H, READY_MS, SCORE_MS, TICK_MS } from '../server/types';
import type { State } from '../server/types';

const T0 = 1000;
const kit = testKit(game, {
  t0: T0,
  players: testPlayers(8),
  settings: { rounds: 2, seconds: 30 },
});
const setPeaks = (s: State): State => ({
  ...s,
  world: {
    ...s.world,
    climbers: s.world.climbers.map((c, i) => ({ ...c, peak: i < 2 ? 100.9 : i * 10.8 })),
  },
});

describe('Doodle Climb match', () => {
  it('starts immediately after the shell countdown, with a bounded climb and one timer beat', () => {
    const s = kit.start();
    expect(s.phase).toEqual({ id: 'play', startedAt: T0, deadline: T0 + TICK_MS });
    expect(s.round).toBe(1);
    expect(s.endsAt).toBe(T0 + 30_000);
    expect(s.began).toBe(T0);
    expect(s.world.stepped).toBe(0);
    expect(s.world.climbers).toHaveLength(8);
    expect(game.results(s)).toBeNull();
    const beat = kit.timer(s);
    expect(beat.phase).toEqual({ id: 'play', startedAt: T0, deadline: T0 + 2 * TICK_MS });
    expect(beat.elapsed).toBe(TICK_MS);
  });

  it('settles input at arrival time and clamps a late round timer to its cap', () => {
    const s = kit.input(kit.start(), 'p1', { type: 'steer', dir: 1 }, T0 + 700);
    expect(s.elapsed).toBe(700);
    expect(s.world.climbers[0]!.dir).toBe(1);
    expect(s.world.climbers[1]!.dir).toBe(0);
    expect(kit.input(s, 'p1', { type: 'steer', dir: -1 }, T0 + 100)).toBe(s);
    const late = kit.timer(kit.start(), T0 + 90_000);
    expect(late.phase.id).toBe('score');
    expect(late.elapsed).toBeLessThanOrEqual(30_000);
    expect(late.phase.deadline).toBe(T0 + 90_000 + SCORE_MS);
  });

  it('locks points once at the reveal, then resets only the next round', () => {
    const start = setPeaks(kit.start());
    const scored = kit.vip(start, 'skip', T0);
    expect(scored.phase.id).toBe('score');
    expect(scored.scores).toEqual({
      p1: 100,
      p2: 100,
      p3: 21,
      p4: 32,
      p5: 43,
      p6: 54,
      p7: 64,
      p8: 75,
    });
    expect(scored.lastPoints).toEqual(scored.scores);
    expect(credit(scored).scores.p1).toBe(200);
    const ready = kit.timer(scored);
    expect(ready.phase.id).toBe('ready');
    expect(ready.round).toBe(2);
    expect(ready.phase.deadline).toBe(ready.phase.startedAt + READY_MS);
    expect(ready.scores).toEqual(scored.scores);
    expect(ready.lastPoints).toEqual({});
    expect(ready.world.climbers.every((c) => c.peak === 0 && c.died === null && c.dir === 0)).toBe(
      true,
    );
    expect(ready.world.platforms).not.toEqual(scored.world.platforms);
    expect(kit.timer(ready).phase.id).toBe('play');
  });

  it('finishes the configured last reveal, shares tied ranks and never scores twice', () => {
    const scored = kit.vip(setPeaks(kit.start({ settings: { rounds: 1 } })), 'skip', T0);
    const done = kit.timer(scored);
    expect(done.phase.id).toBe('done');
    expect(done.phase.deadline).toBeNull();
    expect(done.scores).toEqual(scored.scores);
    expect(game.results(done)?.winnerIds).toEqual(['p1', 'p2']);
    expect(game.results(done)?.ranking).toHaveLength(8);
    expect(game.controllerView(done, 'p1').rank).toBe(1);
    expect(game.controllerView(done, 'p3').rank).toBe(8);
    expect(game.controllerView(done, 'spectator').rank).toBeNull();
    expect(kit.vip(done, 'skip')).toBe(done);
    expect(kit.timer(done)).toBe(done);
    expect(kit.vip(done, 'end').scores).toEqual(done.scores);
  });

  it('ends when every climber falls and credits an early host end', () => {
    const s = setPeaks(kit.start());
    const allLost: State = {
      ...s,
      world: { ...s.world, climbers: s.world.climbers.map((c) => ({ ...c, died: 0 })) },
    };
    expect(kit.timer(allLost).phase.id).toBe('score');
    const ended = kit.vip(s, 'end', T0);
    expect(ended.phase.id).toBe('done');
    expect(ended.scores.p1).toBe(100);
    expect(game.results(ended)?.ranking).toHaveLength(8);
  });

  it('freezes pause time and moves the round clocks and beat together on resume', () => {
    const initial = kit.input(kit.start(), 'p1', { type: 'steer', dir: 1 }, T0);
    const paused = kit.vip(initial, 'pause', T0 + 500);
    expect(paused.elapsed).toBe(500);
    expect(paused.world.climbers.every((c) => c.dir === 0)).toBe(true);
    expect(paused.phase.paused).toEqual({ at: T0 + 500 });
    expect(kit.timer(paused, T0 + 20_000)).toBe(paused);
    expect(kit.input(paused, 'p1', { type: 'steer', dir: -1 }, T0 + 20_000)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', T0 + 5500);
    expect(resumed.began).toBe(initial.began + 5000);
    expect(resumed.endsAt).toBe(initial.endsAt + 5000);
    expect(resumed.phase.deadline).toBe(paused.phase.deadline! + 5000);
    expect(resumed.world).toBe(paused.world);
    expect(resumed.world.climbers.every((c) => c.dir === 0)).toBe(true);
    expect(resumed.phase.paused).toBeUndefined();
    expect(kit.timer(resumed, T0 + 5600).elapsed).toBe(600);
  });

  it('skip while paused judges only active time and starts a clean reveal', () => {
    const paused = kit.vip(kit.start(), 'pause', T0 + 500);
    const skipped = kit.vip(paused, 'skip', T0 + 20_500);
    expect(skipped.phase.id).toBe('score');
    expect(skipped.elapsed).toBe(paused.elapsed);
    expect(skipped.world).toEqual(paused.world);
    expect(skipped.phase.paused).toBeUndefined();
    expect(skipped.phase.deadline).toBe(T0 + 20_500 + SCORE_MS);
  });

  it('releases a lost hold, retains the run on refresh, and finishes after all phones drop', () => {
    const start = kit.input(kit.start(), 'p1', { type: 'steer', dir: 1 }, T0 + 500);
    const dropped = kit.player(start, 'p1', false, undefined, T0 + 600);
    expect(dropped.players.p1!.connected).toBe(false);
    expect(dropped.world.climbers[0]!.dir).toBe(0);
    expect(dropped.world.climbers[0]!.peak).toBeGreaterThanOrEqual(start.world.climbers[0]!.peak);
    expect(dropped.world.climbers[0]!.x).toBeCloseTo(start.world.climbers[0]!.x + 15, 6);
    expect(kit.input(dropped, 'p1', { type: 'steer', dir: -1 }, T0 + 800)).toBe(dropped);
    const rejoined = kit.player(dropped, 'p1', true, undefined, T0 + 1000);
    expect(rejoined.world).toBe(dropped.world);
    expect(game.controllerView(rejoined, 'p1').mine).toEqual(dropped.world.climbers[0]);
    expect(
      kit.input(rejoined, 'p1', { type: 'steer', dir: -1 }, T0 + 1000).world.climbers[0]!.dir,
    ).toBe(-1);
    const left = kit.player(rejoined, 'p1', false, 'left', T0 + 1100);
    expect(left.world.climbers[0]!.died).not.toBeNull();
    expect(left.left).toContain('p1');
    const nextReady = kit.timer(kit.vip(left, 'skip', T0 + 1100));
    expect(nextReady.phase.id).toBe('ready');
    expect(nextReady.world.climbers[0]).toMatchObject({ died: 0, peak: 0 });
    const nextPlay = kit.vip(nextReady, 'skip');
    expect(nextPlay.world.climbers[0]!.died).toBe(0);
    expect(botInput(nextPlay, 'p1', createRng(2))).toBeNull();
    const final = kit.until(nextPlay, 'done', 1000);
    expect(final.scores.p1).toBe(nextReady.scores.p1);
    let empty = start;
    for (const id of Object.keys(empty.players)) empty = kit.player(empty, id, false);
    const done = kit.until(empty, 'done', 2000);
    expect(game.results(done)?.ranking).toHaveLength(8);
  });

  it('ignores spectator inputs, prototype ids, stale timers and unrelated speech in every phase', () => {
    const play = kit.start();
    const score = kit.vip(play, 'skip', T0);
    const ready = kit.timer(score);
    const done = kit.vip(score, 'end');
    for (const s of [play, score, ready, done]) {
      for (const id of ['spectator', '__proto__', 'constructor', '']) {
        expect(kit.input(s, id, { type: 'steer', dir: 1 })).toBe(s);
        expect(kit.player(s, id, false)).toBe(s);
        expect(game.controllerView(s, id).mine).toBeNull();
      }
      expect(
        game.reduce(s, {
          type: 'timer',
          now: s.phase.deadline ?? T0,
          phaseId: s.phase.id,
          startedAt: s.phase.startedAt - 1,
        }),
      ).toBe(s);
      expect(
        game.reduce(s, {
          type: 'timer',
          now: s.phase.deadline ?? T0,
          phaseId: 'no-such-phase',
          startedAt: s.phase.startedAt,
        }),
      ).toBe(s);
      expect(kit.speech(s, 'unrelated', -1)).toBe(s);
      expect(game.reduce(s, { type: 'speechStart', now: T0, key: 'unrelated' })).toBe(s);
    }
  });
});

describe('Doodle Climb public views and bots', () => {
  it('shows each player the same public stage but only their own control identity', () => {
    const s = kit.start({ presence: { mode: 'remote-text', phoneOnly: true } });
    expect(s.phoneOnly).toBe(true);
    const tv = game.tvView(s);
    for (const id of [...Object.keys(s.players), 'spectator']) {
      const cv = game.controllerView(s, id);
      expect(cv.platforms).toEqual(tv.platforms);
      expect(cv.climbers).toEqual(tv.climbers);
      expect(cv.me.id).toBe(id);
      expect(cv.mine?.id ?? null).toBe(s.players[id] ? id : null);
      expect(JSON.parse(JSON.stringify(cv))).toEqual(cv);
    }
    expect(tv.platforms.length).toBeLessThan(s.world.platforms.length);
    expect(tv.timerMode).toBe('hidden');
  });

  it('does not reveal future route or RNG; changing them leaves all visible views identical', () => {
    const s = kit.start();
    const changed: State = {
      ...s,
      rng: { seed: 8675309, step: 999 },
      world: {
        ...s.world,
        platforms: s.world.platforms.map((p) =>
          p.y > H
            ? { ...p, x: (p.x + 100) % 240, kind: p.kind === 'spring' ? 'normal' : 'spring' }
            : p,
        ),
      },
    };
    expect(game.tvView(changed)).toEqual(game.tvView(s));
    expect(JSON.stringify(game.tvView(s))).not.toMatch(/"rng"|"world"|"stepped"/);
    for (const id of [...Object.keys(s.players), 'spectator']) {
      expect(game.controllerView(changed, id)).toEqual(game.controllerView(s, id));
      expect(JSON.stringify(game.controllerView(s, id))).not.toContain('"rng"');
      expect(botInput(changed, id, createRng(4), 'sharp')).toEqual(
        botInput(s, id, createRng(4), 'sharp'),
      );
    }
  });

  it('bots choose valid steering with all three strengths and sit out outside play', () => {
    const s = kit.start();
    const aimed: State = {
      ...s,
      world: {
        ...s.world,
        climbers: s.world.climbers.map((c) => ({ ...c, x: 20 })),
        platforms: [{ id: 1, x: 80, y: 50, width: 44, kind: 'normal' }],
      },
    };
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      const input = botInput(aimed, 'p1', createRng(2), skill);
      expect(input).toEqual({ type: 'steer', dir: 1 });
      expect(game.inputSchema.safeParse(input).success).toBe(true);
      expect(botInput(aimed, 'spectator', createRng(2), skill)).toBeNull();
      expect(botInput(kit.vip(s, 'skip', T0), 'p1', createRng(2), skill)).toBeNull();
      expect(botInput(kit.player(s, 'p1', false), 'p1', createRng(2), skill)).toBeNull();
    }
  });
});
