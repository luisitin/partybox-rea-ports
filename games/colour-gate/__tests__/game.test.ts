import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { botInput } from '../server/bot';
import { IMPULSE, ROUND_MS, SCORE_MS, TICK_MS } from '../server/types';
import type { State } from '../server/types';

const T0 = 1_000_000;
const kit = testKit(game, { t0: T0, players: testPlayers(8), settings: { rounds: 2 } });
const atCap = (s: State): State => kit.timer(s, s.endsAt);

describe('Colour Gate party lifecycle', () => {
  it('opens immediately in play, with 45 s per round and a rearmed 100 ms physics beat', () => {
    const s = kit.start();
    expect(s.phase.id).toBe('play');
    expect(s.phase.startedAt).toBe(T0);
    expect(s.began).toBe(T0);
    expect(s.endsAt).toBe(T0 + 45_000);
    expect(s.endsAt - s.began).toBe(ROUND_MS);
    expect(s.phase.deadline).toBe(T0 + 100);
    const beat = kit.timer(s);
    expect(beat.phase.id).toBe('play');
    expect(beat.phase.deadline).toBe(T0 + 2 * TICK_MS);
    expect(beat.world.checked).toBe(100);
    expect(s.world.checked).toBe(0);
    expect(game.results(s)).toBeNull();
  });

  it('applies only the sender tap at arrival, preserving the other seven lanes', () => {
    const s = kit.start();
    const tapped = kit.input(s, 'p3', { type: 'tap' }, T0 + 300);
    expect(tapped.world.runners[2]!.velocity).toBe(IMPULSE);
    expect(tapped.world.runners[2]!.lastTap).toBe(300);
    expect(tapped.world.runners[2]!.launched).toBe(true);
    expect(tapped.world.runners.filter((r) => r.id !== 'p3')).toEqual(
      s.world.runners.filter((r) => r.id !== 'p3'),
    );
  });

  it('shows standings for six seconds, carries scores, and starts a fresh seeded next course', () => {
    let s = kit.start();
    s = {
      ...s,
      world: {
        ...s.world,
        runners: s.world.runners.map((r, i) => ({ ...r, bestHeight: (i + 1) * 6 })),
      },
    };
    const score = atCap(s);
    expect(score.phase.id).toBe('score');
    expect(score.phase.deadline).toBe(score.phase.startedAt + 6000);
    expect(score.phase.deadline! - score.phase.startedAt).toBe(SCORE_MS);
    expect(score.scores).toEqual(score.lastPoints);
    expect(score.lastPoints.p1).toBe(5);
    const next = kit.timer(score);
    expect(next.phase.id).toBe('play');
    expect(next.round).toBe(2);
    expect(next.scores).toEqual(score.scores);
    expect(next.world.gates).not.toEqual(s.world.gates);
    expect(
      next.world.runners.every((r) => r.gates === 0 && r.bestHeight === 0 && r.crashes === 0),
    ).toBe(true);
  });

  it('adds rounds once, ignores taps on standings, and finishes with complete shared ranks', () => {
    const first = atCap(kit.start());
    expect(kit.input(first, 'p1', { type: 'tap' }, first.phase.startedAt + 100)).toBe(first);
    let final = atCap(kit.timer(first));
    expect(final.phase.id).toBe('score');
    final = kit.timer(final);
    expect(final.phase.id).toBe('done');
    expect(final.phase.deadline).toBeNull();
    const result = game.results(final)!;
    expect(Object.keys(result.scores)).toHaveLength(8);
    expect(result.ranking.map((r) => r.playerId)).toEqual(testPlayers(8).map((p) => p.id));
    expect(result.ranking.every((r) => r.rank === 1 && r.score === 0)).toBe(true);
    expect(result.winnerIds).toHaveLength(8);
    expect(kit.timer(final, final.phase.startedAt + 999_999)).toBe(final);
    expect(kit.input(final, 'p1', { type: 'tap' })).toBe(final);
  });

  it('adds a positive second-round score to prior points rather than replacing or double counting it', () => {
    let first = kit.start();
    first = {
      ...first,
      world: {
        ...first.world,
        runners: first.world.runners.map((r) => ({ ...r, gates: 2, bestHeight: 300 })),
      },
    };
    const score = atCap(first);
    expect(score.scores.p1).toBe(250);
    let second = kit.timer(score);
    second = {
      ...second,
      world: {
        ...second.world,
        runners: second.world.runners.map((r) => ({ ...r, gates: 1, bestHeight: 180 })),
      },
    };
    const final = atCap(second);
    expect(final.lastPoints.p1).toBe(150);
    expect(final.scores.p1).toBe(400);
    expect(kit.timer(final).scores.p1).toBe(400);
  });

  it('lets the VIP skip each phase and end a running party without dropping anyone', () => {
    const score = kit.vip(kit.start(), 'skip');
    expect(score.phase.id).toBe('score');
    const second = kit.vip(score, 'skip');
    expect(second.phase.id).toBe('play');
    expect(second.round).toBe(2);
    const done = kit.vip(second, 'end');
    expect(done.phase.id).toBe('done');
    expect(game.results(done)!.ranking).toHaveLength(8);
  });

  it('freezes input, timers and physics on pause, shifts all clocks on resume, and skips paused phases', () => {
    const s = kit.timer(kit.start());
    const paused = kit.vip(s, 'pause', T0 + 100);
    expect(paused.phase.paused).toEqual({ at: T0 + 100 });
    expect(kit.input(paused, 'p1', { type: 'tap' }, T0 + 900)).toBe(paused);
    expect(kit.timer(paused, T0 + 1000)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', T0 + 5100);
    expect(resumed.phase.paused).toBeUndefined();
    expect(resumed.endsAt).toBe(s.endsAt + 5000);
    expect(resumed.began).toBe(s.began + 5000);
    expect(resumed.phase.deadline).toBe(s.phase.deadline! + 5000);
    expect(resumed.world).toEqual(s.world);
    expect(kit.timer(resumed).world.checked).toBe(200);
    expect(kit.vip(paused, 'skip', T0 + 5100).phase.id).toBe('score');
  });

  it('ignores spectators, prototype keys, pre-round input and stale or early timers', () => {
    const s = kit.start();
    for (const id of ['ghost', '', '__proto__', 'constructor']) {
      expect(kit.input(s, id, { type: 'tap' }, T0 + 200)).toBe(s);
      expect(kit.player(s, id, false)).toBe(s);
    }
    expect(kit.input(s, 'p1', { type: 'tap' }, T0 - 1)).toBe(s);
    expect(kit.timer(s, T0 + 99)).toBe(s);
    expect(game.reduce(s, { type: 'timer', now: T0 + 100, phaseId: 'score', startedAt: T0 })).toBe(
      s,
    );
    expect(
      game.reduce(s, { type: 'timer', now: T0 + 100, phaseId: 'play', startedAt: T0 - 1 }),
    ).toBe(s);
  });

  it('rejects backwards VIP clock commands instead of awarding extra race time', () => {
    const running = kit.timer(kit.start(), T0 + 500);
    for (const action of ['pause', 'resume', 'skip', 'end'] as const)
      expect(kit.vip(running, action, T0 + 200)).toBe(running);
    const paused = kit.vip(running, 'pause', T0 + 1000);
    expect(kit.vip(paused, 'resume', T0 + 999)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', T0 + 2000);
    expect(resumed.endsAt).toBe(running.endsAt + 1000);
  });

  it('keeps a reconnect in its lane and never waits for disconnected players', () => {
    const tapped = kit.input(kit.start(), 'p1', { type: 'tap' }, T0 + 100);
    const dropped = kit.player(tapped, 'p1', false);
    expect(dropped.players.p1!.connected).toBe(false);
    expect(dropped.world).toEqual(tapped.world);
    const rejoined = kit.player(dropped, 'p1', true);
    expect(rejoined.players.p1!.connected).toBe(true);
    expect(rejoined.world).toEqual(tapped.world);
    let absent = kit.start();
    for (const p of testPlayers(8)) absent = kit.player(absent, p.id, false);
    expect(kit.until(absent, 'done', 2000).phase.id).toBe('done');
  });

  it('makes the complete public course equally visible and selects only the owner controls', () => {
    const s = kit.input(
      kit.start({ presence: { mode: 'together', phoneOnly: true } }),
      'p3',
      { type: 'tap' },
      T0 + 200,
    );
    const tv = game.tvView(s);
    expect(tv.world).toEqual(s.world);
    expect(tv.world.runners).toHaveLength(8);
    for (const id of ['p1', 'p3', 'p8', 'spectator', '__proto__']) {
      const cv = game.controllerView(s, id);
      expect(cv).not.toHaveProperty('rng');
      expect(cv).not.toHaveProperty('settings');
      expect(cv.world).toEqual(tv.world);
      expect(cv.phoneStage).toBe(true);
      expect(cv.me.role).toBe(id.startsWith('p') && id !== '__proto__' ? 'player' : 'spectator');
      expect(cv.runner).toEqual(s.world.runners.find((r) => r.id === id) ?? null);
    }
    expect(game.controllerView(s, 'p1').runner).not.toEqual(game.controllerView(s, 'p3').runner);
    expect(tv).not.toHaveProperty('rng');
  });

  it('returns only schema-valid taps from all three strategies, with waiting and spectator sit-outs', () => {
    const s = kit.start();
    for (const skill of ['easy', 'normal', 'sharp'] as const) {
      const rng = createRng(4);
      const input = botInput(s, 'p1', rng, skill);
      expect(input === null || game.inputSchema.safeParse(input).success).toBe(true);
      expect(botInput(s, 'ghost', rng, skill)).toBeNull();
      expect(botInput(atCap(s), 'p1', rng, skill)).toBeNull();
      const retry = {
        ...s,
        world: { ...s.world, runners: s.world.runners.map((r) => ({ ...r, respawnAt: 1200 })) },
      };
      expect(botInput(retry, 'p1', rng, skill)).toBeNull();
    }
    expect(game.inputSchema.safeParse({ type: 'tap' }).success).toBe(true);
    expect(game.inputSchema.safeParse({ type: 'steer', dir: 1 }).success).toBe(false);
  });
});
