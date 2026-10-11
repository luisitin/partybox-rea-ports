import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { testPlayers } from '@partybox/game-sdk/testing';
import { slide, spawn } from '../server/board';
import { game } from '../server/index';

const transpose = (board: number[]): number[] =>
  Array.from({ length: 16 }, (_, i) => board[(i % 4) * 4 + Math.floor(i / 4)]!);
const horizontal = (board: number[]): number[] =>
  Array.from({ length: 16 }, (_, i) => board[Math.floor(i / 4) * 4 + 3 - (i % 4)]!);
const sum = (board: number[]): number => board.reduce((n, x) => n + x, 0);
const potential = (board: number[]): number =>
  board.reduce((n, x) => n + (x === 0 ? 0 : x * Math.log2(x)), 0);
const tile = fc.constantFrom(0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024);
const boards = fc.array(tile, { minLength: 16, maxLength: 16 });

describe('seeded board properties', () => {
  // A recorded generator seed makes all 1,000 random cases reproducible. Explicit seeds 1–3
  // additionally exercise the requested named seeds rather than relying on an unrecorded run.
  it.each([1, 2, 3, 204809])('preserves mass and symmetry with fast-check seed %i', (seed) => {
    fc.assert(
      fc.property(boards, fc.integer({ min: 0, max: 65535 }), (board, slot) => {
        const snapshot = [...board];
        for (const dir of ['up', 'down', 'left', 'right'] as const) {
          const result = slide(board, dir);
          expect(result.board).toHaveLength(16);
          expect(sum(result.board)).toBe(sum(board));
          expect(result.gain).toBe(potential(result.board) - potential(board));
          expect(result.board.filter(Boolean).length).toBeLessThanOrEqual(
            board.filter(Boolean).length,
          );
          expect(result.changed).toBe(JSON.stringify(result.board) !== JSON.stringify(board));
          for (const value of result.board)
            expect(value === 0 || (value >= 2 && Number.isInteger(Math.log2(value)))).toBe(true);
        }
        const left = slide(board, 'left');
        const right = slide(horizontal(board), 'right');
        expect(horizontal(right.board)).toEqual(left.board);
        expect(right.gain).toBe(left.gain);
        const up = slide(transpose(board), 'up');
        expect(transpose(up.board)).toEqual(left.board);
        expect(up.gain).toBe(left.gain);
        const drawn = spawn(board, { slot, value: 2 });
        expect(sum(drawn)).toBe(sum(board) + (board.includes(0) ? 2 : 0));
        expect(drawn.filter(Boolean).length).toBe(
          board.filter(Boolean).length + (board.includes(0) ? 1 : 0),
        );
        for (let i = 0; i < 16; i++) if (board[i] !== 0) expect(drawn[i]).toBe(board[i]);
        expect(board).toEqual(snapshot);
      }),
      { seed, numRuns: seed === 204809 ? 1000 : 1, endOnFailure: true },
    );
  });

  it('replays seeds 1, 2, 3 and 1,000 distinct generated race seeds without divergence', () => {
    const [generated] = fc.sample(
      fc.uniqueArray(fc.integer({ min: 4, max: 2_147_483_647 }), {
        minLength: 1000,
        maxLength: 1000,
      }),
      { seed: 204809, numRuns: 1 },
    );
    const seeds = [1, 2, 3, ...generated!];
    expect(new Set(seeds).size).toBe(1003);
    for (const seed of seeds) {
      const init = { players: testPlayers(2), settings: {}, seed, now: 1000 };
      const left = game.init(init);
      const right = game.init(init);
      expect(JSON.stringify(left)).toBe(JSON.stringify(right));
      expect(left.racers.p1?.board).toEqual(left.racers.p2?.board);
      const event = {
        type: 'timer' as const,
        now: left.phase.deadline!,
        phaseId: left.phase.id,
        startedAt: left.phase.startedAt,
      };
      const a = game.reduce(left, event);
      const b = game.reduce(right, event);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.phase.id).toBe('reveal');
      expect(game.tvView(a)).toEqual(game.tvView(b));
      expect(JSON.stringify(game.tvView(a))).not.toContain('"spawns"');
    }
  });
});
