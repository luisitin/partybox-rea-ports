// Presence and pause may judge elapsed combat, but cannot rewrite its completed result.
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { game } from '../server/index';
import type { State } from '../server/types';

const kit = testKit(game, { players: testPlayers(2) });
function pendingWin(): State {
  const state = kit.start();
  return {
    ...state,
    phase: { ...state.phase, deadline: kit.t0 + 1200 },
    checked: 1080,
    world: {
      ...state.world,
      maze: {
        cols: 10,
        rows: 6,
        cell: 16,
        walls: [
          { x1: 0, y1: 0, x2: 160, y2: 0 },
          { x1: 160, y1: 0, x2: 160, y2: 96 },
          { x1: 0, y1: 96, x2: 160, y2: 96 },
          { x1: 0, y1: 0, x2: 0, y2: 96 },
        ],
      },
      tanks: state.world.tanks.map((tank) => ({
        ...tank,
        ...(tank.id === 'p1'
          ? { x: 24, y: 24, angle: 0, ammo: 4, reloadAt: 1140 }
          : { x: 48, y: 24, angle: Math.PI }),
      })),
      bullets: [
        {
          id: 1,
          owner: 'p1',
          x: 44.14,
          y: 24,
          vx: 43,
          vy: 0,
          born: 720,
          bounces: 0,
          kind: 'shell',
        },
      ],
      pickups: [],
      stepped: 54,
      nextBullet: 2,
    },
  };
}

describe('completed fights retain their judged outcome', () => {
  it('credits the locked survivor before a late leave and still excludes that seat next round', () => {
    const pending = pendingWin();
    const before = JSON.stringify(pending);
    const scored = kit.player(pending, 'p1', false, 'left', kit.t0 + 1200);
    expect(scored.phase.id).toBe('score');
    expect(scored.checked).toBe(1100);
    expect(scored.reason).toBe('last-standing');
    expect(scored.scores).toEqual({ p1: 1, p2: 0 });
    expect(scored.lastPoints).toEqual({ p1: 1, p2: 0 });
    expect(scored.winnerIds).toEqual(['p1']);
    expect(scored.players.p1!.connected).toBe(false);
    expect(scored.left).toContain('p1');
    expect(game.controllerView(scored, 'p1').participating).toBe(false);
    const returned = kit.player(scored, 'p1', true, undefined, kit.t0 + 1201);
    expect(returned.scores).toEqual(scored.scores);
    const ready = kit.timer(returned);
    expect(ready.phase.id).toBe('ready');
    expect(ready.world.tanks.map((tank) => tank.id)).toEqual(['p2']);
    expect(ready.scores.p1).toBe(1);
    expect(JSON.stringify(pending)).toBe(before);
  });

  it('retains the cap draw when a camper leaves after combat expires', () => {
    const state = kit.start();
    const scored = kit.player(state, 'p1', false, 'left', state.endsAt + 10);
    expect(scored.phase.id).toBe('score');
    expect(scored.reason).toBe('time');
    expect(scored.scores).toEqual({ p1: 0, p2: 0 });
    expect(scored.lastPoints).toEqual({ p1: 0, p2: 0 });
    expect(scored.winnerIds).toEqual([]);
    expect(scored.left).toContain('p1');
    expect(scored.players.p1!.connected).toBe(false);
  });

  it.each(['win', 'cap'] as const)(
    'pause judges a completed %s, then holds SCORE through leave/resume',
    (outcome) => {
      const state = outcome === 'win' ? pendingWin() : kit.start();
      const at = outcome === 'win' ? kit.t0 + 1200 : state.endsAt + 10;
      const paused = kit.vip(state, 'pause', at);
      expect(paused.phase.id).toBe('score');
      expect(paused.phase.paused?.at).toBe(at);
      expect(paused.reason).toBe(outcome === 'win' ? 'last-standing' : 'time');
      const expected = { p1: outcome === 'win' ? 1 : 0, p2: 0 };
      expect(paused.scores).toEqual(expected);
      expect(paused.lastPoints).toEqual(expected);
      expect(paused.world.tanks.every((tank) => !tank.drive && !tank.turn && !tank.fire)).toBe(
        true,
      );
      const left = kit.player(paused, 'p1', false, 'left', at + 100);
      expect(left.scores).toEqual(expected);
      expect(left.lastPoints).toEqual(expected);
      expect(left.left).toContain('p1');
      const resumed = kit.vip(left, 'resume', at + 1000);
      expect(resumed.phase.id).toBe('score');
      expect(resumed.phase.paused).toBeUndefined();
      expect(resumed.phase.deadline).toBe(paused.phase.deadline! + 1000);
      expect(resumed.scores).toEqual(expected);
      expect(resumed.lastPoints).toEqual(expected);
      expect(resumed.winnerIds).toEqual(outcome === 'win' ? ['p1'] : []);
    },
  );

  it('defers two departures during a genuinely ongoing pause until resume, drawing with no survivors', () => {
    const paused = kit.vip(kit.start(), 'pause', kit.t0 + 1);
    const first = kit.player(paused, 'p1', false, 'left', kit.t0 + 2);
    const second = kit.player(first, 'p2', false, 'left', kit.t0 + 3);
    expect(first.phase.id).toBe('play');
    expect(second.phase.id).toBe('play');
    expect(second.phase.paused).toBeDefined();
    expect(second.scores).toEqual({ p1: 0, p2: 0 });
    const resumed = kit.vip(second, 'resume', kit.t0 + 100);
    expect(resumed.phase.id).toBe('score');
    expect(resumed.reason).toBe('draw');
    expect(resumed.scores).toEqual({ p1: 0, p2: 0 });
    expect(resumed.lastPoints).toEqual({ p1: 0, p2: 0 });
  });
});
