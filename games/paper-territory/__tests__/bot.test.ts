import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Runner, World } from '../server/types';

describe('public trail threat strategy', () => {
  it('a sharp bot returns home when a distant enemy approaches the beginning of its trail', () => {
    const kit = testKit(game, { players: testPlayers(2) });
    const state = kit.timer(kit.start());
    const width = 7;
    const cell = (x: number, y: number): number => y * width + x;
    const owners = Array<number>(49).fill(-1);
    owners[cell(2, 2)] = 0;
    owners[cell(0, 2)] = 1;
    const me: Runner = {
      ...state.world.runners[0]!,
      home: cell(2, 2),
      cell: cell(4, 3),
      dir: 1,
      queued: 1,
      trail: [cell(3, 2), cell(4, 2), cell(4, 3)],
      area: 1,
    };
    const rival: Runner = {
      ...state.world.runners[1]!,
      home: cell(0, 2),
      cell: cell(0, 2),
      dir: 2,
      queued: 2,
      area: 1,
    };
    const world: World = {
      width,
      height: 7,
      owners,
      homes: Array<number>(49).fill(-1),
      runners: [me, rival],
      stepped: 0,
    };
    const threatened = { ...state, world };
    expect(game.bot.sampleInput(threatened, 'p1', createRng(1), 'sharp')).toEqual({
      type: 'direction',
      dir: 2,
    });
    expect(game.bot.sampleInput(threatened, 'p1', createRng(1), 'normal')).toEqual({
      type: 'direction',
      dir: 1,
    });
    const unthreatened = {
      ...threatened,
      world: { ...world, runners: [me, { ...rival, cell: cell(0, 6) }] },
    };
    expect(game.bot.sampleInput(unthreatened, 'p1', createRng(1), 'sharp')).toEqual({
      type: 'direction',
      dir: 1,
    });
  });
});
