import { createRng, seedRng } from '@partybox/game-sdk';
import { finishGame, fuzzOnce, testPlayers } from '@partybox/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import { settle } from '../server/phases/play';
import { crosses, inputSchema, makeWave, targetsAt } from '../server/world';
import type { Input, State } from '../server/types';
import { apex, hit, kit, target, withSeat } from './helpers';

describe('the seeded fountain', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'starts %i players straight in the sixty-second round',
    (count) => {
      const state = kit.start({ players: testPlayers(count) });
      expect(state.phase.id).toBe('play');
      expect(state.endsAt - state.began).toBe(60_000);
      expect(state.phase.deadline).toBe(state.began + 200);
      expect(Object.keys(state.seats)).toHaveLength(count);
      expect(state.fruit.every((f) => !f.bomb)).toBe(true);
      expect(game.results(state)).toBeNull();
    },
  );

  it('draws identical waves for identical seeds and changes them for other seeds', () => {
    const a = makeWave(seedRng(1), 1);
    expect(makeWave(seedRng(1), 1)).toEqual(a);
    expect(makeWave(seedRng(2), 1)).not.toEqual(a);
    expect(a[1].step).toBeGreaterThan(0);
    expect(a[0].filter((f) => f.bomb)).toHaveLength(1);
  });

  it('travels from launch to apex and down in exactly two seconds', () => {
    const fruit = [{ id: 0, kind: 0, x: 50, drift: 4, peak: 25, bomb: false }];
    expect(targetsAt(fruit, 2000, 1)[0]).toMatchObject({ x: 50, y: 92 });
    expect(targetsAt(fruit, 3000, 1)[0]).toMatchObject({ x: 52, y: 25 });
    expect(targetsAt(fruit, 4000, 1)[0]).toMatchObject({ x: 54, y: 92 });
    expect(targetsAt(fruit, -1, 1)[0]?.y).toBe(92);
    expect(targetsAt(fruit, 9000, 1)[0]?.y).toBe(92);
  });

  it('uses each full segment, its endpoints and inclusive tangency', () => {
    expect(
      crosses(
        [
          { x: 10, y: 57 },
          { x: 90, y: 57 },
        ],
        target(),
      ),
    ).toBe(true);
    expect(
      crosses(
        [
          { x: 50, y: 50 },
          { x: 55, y: 50 },
        ],
        target(),
      ),
    ).toBe(true);
    expect(
      crosses(
        [
          { x: 10, y: 0 },
          { x: 90, y: 0 },
          { x: 90, y: 50 },
          { x: 0, y: 50 },
        ],
        target(),
      ),
    ).toBe(true);
    expect(
      crosses(
        [
          { x: 0, y: 50 },
          { x: 10, y: 50 },
        ],
        target(),
      ),
    ).toBe(false);
  });

  it('the schema rejects oversized, nonfinite and out-of-board gestures', () => {
    const valid = {
      type: 'slice',
      wave: 0,
      frame: 0,
      seq: 0,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
    };
    expect(inputSchema.safeParse(valid).success).toBe(true);
    for (const changed of [
      { wave: 30 },
      { wave: -1 },
      { frame: 60_001 },
      { seq: 1_000_001 },
      { points: [{ x: 0, y: 0 }] },
      { points: Array.from({ length: 33 }, () => ({ x: 0, y: 0 })) },
      {
        points: [
          { x: -1, y: 0 },
          { x: 50, y: 50 },
        ],
      },
      {
        points: [
          { x: Infinity, y: 0 },
          { x: 50, y: 50 },
        ],
      },
    ])
      expect(inputSchema.safeParse({ ...valid, ...changed }).success).toBe(false);
    expect(kit.input(apex(), 'p1', { ...valid, seq: NaN } as Input).seats.p1!.score).toBe(0);
  });
});

describe('personal scores on a shared wave', () => {
  it('credits a safe combo, best combo, cut list and readable feedback', () => {
    const state = hit(withSeat(apex(), { streak: 2 }));
    expect(state.seats.p1).toMatchObject({
      score: 64,
      bestCombo: 3,
      cut: [0, 1, 2],
      hitWave: true,
      feedbackPoints: 64,
    });
    expect(state.seats.p1!.feedback).toContain('3 fruit combo');
    expect(state.seats.p2!.score).toBe(0);
  });

  it('a safe wave raises the streak only once, missed waves break it', () => {
    const first = hit(apex(), {
      points: [
        { x: 10, y: 30 },
        { x: 30, y: 30 },
      ],
    });
    const second = hit(first, {
      points: [
        { x: 40, y: 30 },
        { x: 60, y: 30 },
      ],
    });
    const next = settle(second, second.began + 2000);
    expect(next.seats.p1!.streak).toBe(1);
    expect(next.seats.p1!.cut).toEqual([]);
    expect(next.seats.p1!.strokes).toBe(0);
    expect(next.seats.p1!.feedback).toBe('');
    expect(settle(next, next.began + 4000).seats.p1!.streak).toBe(0);
  });

  it('a bomb lock clears next wave without eliminating the player', () => {
    const bombed = hit(apex(), {
      points: [
        { x: 45, y: 65 },
        { x: 55, y: 65 },
      ],
    });
    expect(bombed.seats.p1).toMatchObject({ bombed: true, feedbackPoints: 0 });
    const next = settle(bombed, bombed.began + 2000);
    expect(next.seats.p1).toMatchObject({ bombed: false, streak: 0, strokes: 0 });
    expect(game.controllerView(next, 'p1').me.role).toBe('player');
  });

  it('accepts a frame twelve hundred milliseconds old but rejects earlier frames and rewinds', () => {
    expect(
      hit(apex({ checked: 1600 }), {
        frame: 400,
        points: [
          { x: 10, y: 52.3 },
          { x: 90, y: 52.3 },
        ],
      }).seats.p1!.score,
    ).toBe(60);
    const state = apex();
    expect(hit(state, {}, 'p1', state.began + 999)).toBe(state);
  });

  it('a player gets the same targets regardless of another player cutting them', () => {
    const state = apex();
    const changed = hit(state);
    expect(game.tvView(changed).targets).toEqual(game.tvView(state).targets);
    expect(game.controllerView(changed, 'p2').targets).toEqual(
      game.controllerView(state, 'p2').targets,
    );
    expect(JSON.stringify(game.controllerView(changed, 'p2'))).not.toMatch(/"(?:rng|cut|seats)"/);
  });
});

describe('event order and lifetime', () => {
  it('pause holds the fountain and resume shifts both round clocks', () => {
    const original = apex();
    const paused = kit.vip(original, 'pause', original.began + 1000);
    expect(kit.timer(paused, original.began + 5000)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', original.began + 7000);
    expect(resumed.began).toBe(original.began + 6000);
    expect(resumed.endsAt).toBe(original.endsAt + 6000);
    expect(resumed.checked).toBe(1000);
    expect(resumed.phase.deadline).toBe(original.phase.deadline! + 6000);
    expect(hit(resumed).seats.p1!.score).toBe(60);
  });

  it('VIP skip finishes the round and end preserves scores', () => {
    const score = kit.vip(hit(apex()), 'skip', kit.t0 + 1000);
    expect(score.phase.id).toBe('score');
    expect(score.phase.deadline).toBe(score.phase.startedAt + 7000);
    expect(game.results(score)).toBeNull();
    const done = kit.vip(score, 'end', score.phase.startedAt + 1000);
    expect(game.results(done)!.scores.p1).toBe(60);
    expect(game.results(done)!.winnerIds).toEqual(['p1']);
    expect(kit.timer(done)).toBe(done);
  });

  it('late round input advances to scores without receiving points', () => {
    const state = apex();
    const late = hit(state, {}, 'p1', state.endsAt);
    expect(late.phase.id).toBe('score');
    expect(late.seats.p1!.score).toBe(0);
    expect(late.checked).toBe(60_000);
  });

  it('all disconnected players still finish; returns keep progress and spectators stay safe', () => {
    let state = hit(apex());
    for (const id of Object.keys(state.players))
      state = kit.player(state, id, false, undefined, kit.t0 + 1000);
    const done = finishGame(game, state)! as State;
    expect(done.phase.id).toBe('done');
    expect(game.results(done)!.scores.p1).toBe(60);
    const spectator = game.controllerView(state, '__proto__');
    expect(spectator.me.role).toBe('spectator');
    expect(spectator.score).toBe(0);
    expect(fuzzOnce(game, state, 3)).toEqual([]);
  });

  it('phone-only and remote phones are stages in every phase', () => {
    const phone = kit.start({ presence: { mode: 'together', phoneOnly: true } });
    expect(game.controllerView(phone, 'p1').stage).toBe(true);
    expect(game.controllerView(phone, 'spectator').stage).toBe(true);
    const remote = {
      ...apex(),
      players: { ...apex().players, p1: { ...apex().players.p1!, canSeeTv: false } },
    };
    expect(game.controllerView(remote, 'p1').stage).toBe(true);
    expect(game.controllerView(remote, 'p2').stage).toBe(false);
    for (const state of [phone, kit.vip(phone, 'skip'), kit.vip(phone, 'end')]) {
      expect(game.controllerView(state, 'p1').stage).toBe(true);
      expect(game.controllerView(state, 'p1').targets.length).toBeGreaterThan(0);
    }
  });

  it.each(['easy', 'normal', 'sharp'] as const)(
    'the %s bot uses schema-valid current gestures',
    (skill) => {
      const state = apex();
      const rng = createRng(1);
      const samples = Array.from({ length: 20 }, () =>
        game.bot.sampleInput(state, 'p1', rng, skill),
      ).filter((input) => input !== null);
      expect(samples.length).toBeGreaterThan(0);
      for (const input of samples) {
        expect(inputSchema.safeParse(input).success).toBe(true);
        expect(input!.wave).toBe(state.wave);
        expect(input!.frame).toBe(state.checked);
        const scored = kit.input(state, 'p1', input!, state.began + state.checked);
        expect(scored.seats.p1!.score).toBeGreaterThan(0);
        if (skill !== 'easy') expect(scored.seats.p1!.bombed).toBe(false);
      }
      expect(game.bot.sampleInput(state, 'ghost', rng, skill)).toBeNull();
      expect(game.bot.sampleInput(kit.vip(state, 'end'), 'p1', rng, skill)).toBeNull();
    },
  );
});
