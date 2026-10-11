import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Runner, World } from '../server/types';

describe('public trail threat strategy', () => {
  it('does not repeat an already queued heading before the next physics tick', () => {
    const kit = testKit(game, { players: testPlayers(2) });
    const play = kit.timer(kit.start());
    const moved = kit.timer(play, play.began + 1200);
    const input = game.bot.sampleInput(moved, 'p1', createRng(2), 'normal');
    expect(input).not.toBeNull();
    const queued = kit.input(moved, 'p1', input!, play.began + 1200);
    expect(game.bot.sampleInput(queued, 'p1', createRng(2), 'normal')).toBeNull();
  });

  it('normal bots capture land at the 600 ms decision cadence for regression seed 2', () => {
    const players = testPlayers(2);
    const kit = testKit(game, { players });
    const rng = createRng(2);
    let state = kit.timer(kit.start({ seed: 2 }));
    let nextDecision = state.began + 599;
    let beats = 0;
    while (state.phase.id === 'play') {
      expect(beats++).toBeLessThan(601);
      const deadline = state.phase.deadline!;
      if (deadline - 1 >= nextDecision) {
        for (const player of rng.shuffle(players)) {
          const input = game.bot.sampleInput(state, player.id, rng, 'normal');
          if (input !== null) state = kit.input(state, player.id, input, deadline - 1);
        }
        nextDecision = deadline - 1 + 600;
      }
      state = kit.timer(state, deadline);
    }
    expect(state.world.runners.every((runner) => runner.captures > 0)).toBe(true);
  });

  it('a sharp bot returns home when a distant enemy approaches the beginning of its trail', () => {
    const kit = testKit(game, { players: testPlayers(2) });
    const state = kit.timer(kit.start());
    const width = 12;
    const cell = (x: number, y: number): number => y * width + x;
    const owners = Array<number>(width * 7).fill(-1);
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
      homes: Array<number>(width * 7).fill(-1),
      runners: [me, rival],
      stepped: 0,
    };
    const threatened = { ...state, world };
    expect(game.bot.sampleInput(threatened, 'p1', createRng(1), 'sharp')).toEqual({
      type: 'direction',
      dir: 2,
    });
    expect(game.bot.sampleInput(threatened, 'p1', createRng(1), 'normal')).toBeNull();
    const unthreatened = {
      ...threatened,
      world: { ...world, runners: [me, { ...rival, cell: cell(0, 6) }] },
    };
    expect(game.bot.sampleInput(unthreatened, 'p1', createRng(1), 'sharp')).toBeNull();
  });
});
