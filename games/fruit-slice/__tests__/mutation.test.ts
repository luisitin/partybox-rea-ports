// Each independent rule is named so the job's real source-mutation runner can target its witness.
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { game } from '../server/index';
import { swipePoints } from '../server/scoring';
import { crosses } from '../server/world';
import { apex, hit, kit, swipe, target, withSeat } from './helpers';

describe('mutation witnesses', () => {
  it('mutation: single fruit base points', () => {
    expect(swipePoints(1, 0)).toBe(10);
  });
  it('mutation: three fruit combo doubles', () => {
    expect(swipePoints(3, 0)).toBe(60);
  });
  it('mutation: two fruit is not a combo', () => {
    expect(swipePoints(2, 0)).toBe(20);
  });
  it('mutation: streak bonus is capped', () => {
    expect(swipePoints(1, 12)).toBe(20);
  });
  it('mutation: bomb gives zero points', () => {
    const state = hit(apex(), {
      points: [
        { x: 50, y: 20 },
        { x: 50, y: 80 },
      ],
    });
    expect(state.seats.p1!.score).toBe(0);
  });
  it('mutation: bomb resets streak', () => {
    const state = hit(withSeat(apex(), { streak: 4 }), {
      points: [
        { x: 50, y: 20 },
        { x: 50, y: 80 },
      ],
    });
    expect(state.seats.p1!.streak).toBe(0);
  });
  it('mutation: bomb locks the rest of its wave', () => {
    const bombed = hit(apex(), {
      points: [
        { x: 45, y: 65 },
        { x: 55, y: 65 },
      ],
    });
    expect(hit(bombed).seats.p1!.score).toBe(0);
    expect(hit(bombed).seats.p1!.strokes).toBe(1);
  });
  it('mutation: duplicate sequence cannot score', () => {
    const first = hit(apex(), {
      points: [
        { x: 10, y: 30 },
        { x: 30, y: 30 },
      ],
    });
    const repeated = hit(first, { seq: 0 });
    expect(repeated.seats.p1!.score).toBe(10);
    expect(repeated.seats.p1!.strokes).toBe(1);
  });
  it('mutation: cut fruit cannot score twice', () => {
    const first = hit(apex());
    expect(hit(first).seats.p1!.score).toBe(60);
  });
  it('mutation: strokes are capped at twenty per wave', () => {
    expect(hit(withSeat(apex(), { strokes: 20 })).seats.p1!.score).toBe(0);
  });
  it('mutation: stale wave cannot score', () => {
    expect(hit(apex(), { wave: 1 }).seats.p1!.score).toBe(0);
  });
  it('mutation: stale frame cannot score', () => {
    expect(
      hit(apex({ checked: 1600 }), {
        frame: 399,
        points: [
          { x: 10, y: 52.4 },
          { x: 90, y: 52.4 },
        ],
      }).seats.p1!.score,
    ).toBe(0);
  });
  it('mutation: future frame cannot score', () => {
    expect(hit(apex(), { frame: 1001 }).seats.p1!.score).toBe(0);
  });
  it('mutation: disconnected player cannot score', () => {
    const state = kit.player(apex(), 'p1', false, undefined, kit.t0 + 1000);
    expect(hit(state).seats.p1!.score).toBe(0);
  });
  it('mutation: strangers cannot score', () => {
    const state = apex();
    expect(hit(state, {}, 'spectator')).toBe(state);
    expect(hit(state, {}, '__proto__')).toBe(state);
  });
  it('mutation: pause prevents scoring', () => {
    const state = kit.vip(apex(), 'pause', kit.t0 + 1000);
    expect(hit(state, {}, 'p1', kit.t0 + 1500)).toBe(state);
  });
  it('mutation: resume extends the round clock', () => {
    const original = apex();
    const paused = kit.vip(original, 'pause', kit.t0 + 1000);
    const resumed = kit.vip(paused, 'resume', kit.t0 + 5000);
    expect(resumed.endsAt).toBe(original.endsAt + 4000);
  });
  it('mutation: bot rejects disconnected player', () => {
    const state = kit.player(apex(), 'p1', false, undefined, kit.t0 + 1000);
    const rng = createRng(1);
    for (let i = 0; i < 20; i++) expect(game.bot.sampleInput(state, 'p1', rng, 'sharp')).toBeNull();
  });
  it('mutation: round deadline exits play', () => {
    const state = kit.timer(kit.start(), kit.t0 + 60_000);
    expect(state.phase.id).toBe('score');
  });
  it('mutation: scores deadline exits to done', () => {
    const score = kit.vip(apex(), 'skip', kit.t0 + 1000);
    const done = kit.timer(score);
    expect(done.phase.id).toBe('done');
    expect(game.results(done)).not.toBeNull();
  });
  it('mutation: TV hides raw cut history', () => {
    expect(JSON.stringify(game.tvView(hit(apex())))).not.toMatch(/"(?:rng|seats|cut)"/);
  });
  it('mutation: own controller removes sliced fruit', () => {
    expect(game.controllerView(hit(apex()), 'p1').targets.map((f) => f.id)).toEqual([3]);
  });
  it('mutation: opponents retain their own fountain', () => {
    const state = apex();
    expect(game.controllerView(hit(state), 'p2').targets).toEqual(
      game.controllerView(state, 'p2').targets,
    );
  });
  it('mutation: segment interior detects fruit', () => {
    expect(
      crosses(
        [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ],
        target(),
      ),
    ).toBe(true);
  });
  it('mutation: distant segment misses fruit', () => {
    expect(
      crosses(
        [
          { x: 0, y: 58 },
          { x: 100, y: 58 },
        ],
        target(),
      ),
    ).toBe(false);
  });
  it('mutation: zero-length swipe never scores', () => {
    expect(
      crosses(
        [
          { x: 50, y: 50 },
          { x: 50, y: 50 },
        ],
        target(),
      ),
    ).toBe(false);
  });
  it('mutation: reconnect retains score', () => {
    const scored = hit(apex());
    const dropped = kit.player(scored, 'p1', false, undefined, kit.t0 + 1000);
    const returned = kit.player(dropped, 'p1', true, undefined, kit.t0 + 1100);
    expect(returned.seats.p1).toEqual(scored.seats.p1);
    expect(game.controllerView(returned, 'p1').score).toBe(60);
  });
  it('mutation: stale timer does not change phase', () => {
    const state = apex();
    expect(
      kit.reduce(state, {
        type: 'timer',
        phaseId: 'play',
        startedAt: state.phase.startedAt - 1,
        now: state.endsAt,
      }),
    ).toBe(state);
  });
  it('mutation: every original player is ranked', () => {
    const state = kit.player(hit(apex()), 'p1', false, 'left', kit.t0 + 1000);
    const done = kit.vip(state, 'end', kit.t0 + 1000);
    expect(
      game
        .results(done)!
        .ranking.map((r) => r.playerId)
        .sort(),
    ).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
  it('mutation: sequence comes from server acknowledgement', () => {
    const state = apex();
    expect(hit(state, { seq: 17 }).seats.p1!.lastSeq).toBe(17);
    expect(swipe(hit(state, { seq: 17 })).seq).toBe(18);
  });
});
