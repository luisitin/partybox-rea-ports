import { describe, expect, it } from 'vitest';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import { TICK_MS } from '../server/types';

const players = testPlayers(4);
const kit = testKit(game, { players, t0: 1_000_000 });
const playing = () => kit.timer(kit.start());

describe('pause, disconnect and return', () => {
  it('stops simulation and steering during pause, shifting all absolute clock views on resume', () => {
    const start = playing();
    const paused = kit.vip(start, 'pause', start.began + 100);
    expect(kit.input(paused, 'p1', { type: 'direction', dir: 0 }, start.began + 1000)).toBe(paused);
    expect(kit.timer(paused, start.began + 1000)).toBe(paused);
    const resumed = kit.vip(paused, 'resume', start.began + 5100);
    expect(resumed.began).toBe(start.began + 5000);
    expect(resumed.endsAt).toBe(start.endsAt + 5000);
    expect(resumed.phase.deadline).toBe(start.phase.deadline! + 5000);
    expect(resumed.world.stepped).toBe(0);
    expect(kit.timer(resumed).world.stepped).toBe(1);
  });

  it('a paused skip resumes the clock before scoring its partial match', () => {
    const start = playing();
    const paused = kit.vip(start, 'pause', start.began + 1000);
    const score = kit.vip(paused, 'skip', start.began + 6000);
    expect(score.phase.id).toBe('score');
    expect(score.world.stepped).toBe(5);
  });

  it('pause settles completed ticks before a VIP end freezes the final scores', () => {
    const start = playing();
    const paused = kit.vip(start, 'pause', start.began + 1000);
    expect(paused.world.stepped).toBe(5);
    expect(paused.checked).toBe(1000);
    const end = kit.vip(paused, 'end', start.began + 6000);
    expect(end.phase.id).toBe('done');
    expect(end.world.stepped).toBe(5);
    expect(game.results(end)?.scores).toEqual(
      Object.fromEntries(paused.world.runners.map((r) => [r.id, r.area])),
    );
  });

  it('stops disconnected movement and blocks disconnected steering until return', () => {
    const start = playing();
    const disconnected = kit.player(start, 'p1', false, undefined, start.began + 100);
    expect(disconnected.world.runners[0]!.alive).toBe(false);
    expect(disconnected.world.runners[0]!.cause).toBe('connection');
    expect(kit.input(disconnected, 'p1', { type: 'direction', dir: 0 }, start.began + 200)).toBe(
      disconnected,
    );
    const later = kit.timer(disconnected, start.began + 4000);
    expect(later.world.runners[0]!.alive).toBe(false);
    expect(later.world.runners[0]!.cell).toBe(disconnected.world.runners[0]!.cell);
    const back = kit.player(later, 'p1', true, undefined, start.began + 4100);
    const awake = kit.timer(back, start.began + 4200);
    expect(awake.world.runners[0]!.alive).toBe(true);
    expect(awake.world.runners[0]!.slot).toBe(0);
  });

  it('a permanent leave never respawns and still appears in complete finite final results', () => {
    const start = playing();
    const gone = kit.player(start, 'p1', false, 'left', start.began + 100);
    expect(gone.left).toContain('p1');
    expect(gone.world.runners[0]!.respawnTick).toBeNull();
    const attempted = kit.player(gone, 'p1', true, undefined, start.began + 1000);
    const end = kit.timer(attempted, attempted.endsAt);
    expect(end.world.runners[0]!.alive).toBe(false);
    const done = kit.timer(end);
    expect(
      game
        .results(done)
        ?.ranking.map((r) => r.playerId)
        .sort(),
    ).toEqual(players.map((p) => p.id).sort());
    expect(Number.isFinite(game.results(done)?.scores['p1'])).toBe(true);
  });

  it('an eliminated runner respawn countdown does not consume paused time', () => {
    const start = playing();
    const dead = kit.player(start, 'p1', false, undefined, start.began + 100);
    const back = kit.player(dead, 'p1', true, undefined, start.began + 150);
    const before = kit.cv(back, 'p1').respawnAt!;
    const paused = kit.vip(back, 'pause', start.began + 180);
    const resumed = kit.vip(paused, 'resume', start.began + 5180);
    expect(kit.cv(resumed, 'p1').respawnAt).toBe(before + 5000);
    expect(kit.timer(resumed, resumed.began + 15 * TICK_MS - 1).world.runners[0]!.alive).toBe(
      false,
    );
    expect(kit.timer(resumed, resumed.began + 15 * TICK_MS).world.runners[0]!.alive).toBe(true);
  });
});
