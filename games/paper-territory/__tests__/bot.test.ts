import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { testKit, testPlayers } from '@partybox/game-sdk/testing';
import { game } from '../server/index';
import type { Runner, World } from '../server/types';
import { applyDirection, tickWorld } from '../server/world';

describe('public trail threat strategy', () => {
  it('turns before a wall beyond the three-tile horizon at the longest 1200 ms decision beat', () => {
    const kit = testKit(game, { players: testPlayers(2) });
    const play = kit.timer(kit.start());
    const me = {
      ...play.world.runners[0]!,
      cell: 10 * 40 + 35,
      dir: 1 as const,
      queued: 1 as const,
      trail: [10 * 40 + 35],
    };
    const state = { ...play, world: { ...play.world, runners: [me, play.world.runners[1]!] } };
    const input = game.bot.sampleInput(state, 'p1', createRng(1), 'normal');
    expect(input).not.toBeNull();
    expect(input!.dir).not.toBe(1);
    const directed = applyDirection(state.world, 'p1', input!);
    expect(tickWorld(directed, 6, ['p1']).runners[0]!.alive).toBe(true);
  });

  it('predicts a rival head collision three ticks ahead while the rival is still inside its home', () => {
    const kit = testKit(game, { players: testPlayers(2) });
    const play = kit.timer(kit.start());
    const at = (x: number, y: number): number => y * 40 + x;
    const me = {
      ...play.world.runners[0]!,
      cell: at(5, 5),
      dir: 1 as const,
      queued: 1 as const,
      trail: [at(5, 5)],
    };
    const rival = {
      ...play.world.runners[1]!,
      home: at(8, 3),
      cell: at(8, 2),
      dir: 2 as const,
      queued: 2 as const,
      trail: [],
    };
    const owners = Array<number>(40 * 28).fill(-1);
    for (let y = 2; y <= 4; y++) for (let x = 7; x <= 9; x++) owners[at(x, y)] = 1;
    const world = { ...play.world, owners, homes: [...owners], runners: [me, rival] };
    const crash = tickWorld(world, 3, ['p1', 'p2']);
    expect(crash.runners.map((r) => r.cause)).toEqual(['head', 'head']);
    const state = { ...play, world };
    const input = game.bot.sampleInput(state, 'p1', createRng(1), 'sharp');
    expect(input).not.toBeNull();
    expect(tickWorld(applyDirection(world, 'p1', input!), 3, ['p1', 'p2']).runners[0]!.alive).toBe(
      true,
    );
  });

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
    const owners = Array<number>(width * 12).fill(-1);
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
      height: 12,
      owners,
      homes: Array<number>(width * 12).fill(-1),
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
