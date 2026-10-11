import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import { game } from '../server/index';
import { cells, fits, rotate } from '../server/pieces';
import { emptyGrid } from '../server/engine';
import { playing } from './helpers';

const input = fc.oneof(
  fc.constantFrom(
    { type: 'move', direction: 'left' },
    { type: 'move', direction: 'right' },
    { type: 'move', direction: 'down' },
    { type: 'rotate', direction: 'cw' },
    { type: 'rotate', direction: 'ccw' },
    { type: 'drop' },
    { type: 'hold' },
    { type: 'target', playerId: 'p2' },
    { type: 'target', playerId: 'ghost' },
    { type: 'unknown' },
  ),
  fc.constant(null),
);

const trace = fc.array(
  fc.record({
    input,
    seat: fc.integer({ min: 1, max: 9 }),
    delta: fc.integer({ min: 0, max: 10_000 }),
    timer: fc.boolean(),
  }),
  { minLength: 8, maxLength: 35 },
);

describe('reducer properties', () => {
  it('is pure, deterministic, JSON-safe and bounded for seeds 1, 2, 3 plus 1000 random seeds', () => {
    const rng = createRng(0x11c1a5);
    const seeds = [1, 2, 3, ...Array.from({ length: 1000 }, () => rng.int(4, 2_000_000_000))];
    const property = fc.property(
      fc.integer({ min: 2, max: 8 }),
      fc.integer({ min: 1, max: 1_000_000 }),
      trace,
      (players, roomSeed, actions) => {
        let state = playing(players, roomSeed);
        let now = state.phase.startedAt;
        for (const action of actions) {
          now += action.delta;
          const event = action.timer
            ? { type: 'timer', now, phaseId: state.phase.id, startedAt: state.phase.startedAt }
            : { type: 'input', now, playerId: `p${action.seat}`, input: action.input };
          const before = JSON.stringify(state);
          const typedEvent = event as Parameters<typeof game.reduce>[1];
          const next = game.reduce(state, typedEvent);
          expect(JSON.stringify(state)).toBe(before);
          expect(game.reduce(state, typedEvent)).toEqual(next);
          expect(JSON.parse(JSON.stringify(next))).toEqual(next);
          expect(game.phases).toContain(next.phase.id);
          for (const board of next.boards) {
            expect(board.grid).toHaveLength(20);
            expect(board.grid.every((row) => row.length === 10)).toBe(true);
            expect(
              board.grid.flat().every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 8),
            ).toBe(true);
            expect(Number.isFinite(board.score) && board.score >= 0).toBe(true);
            expect(board.pending).toBeGreaterThanOrEqual(0);
            if (board.alive && board.active) expect(fits(board.grid, board.active)).toBe(true);
          }
          state = next;
        }
      },
    );
    for (const seed of seeds) fc.assert(property, { seed, numRuns: 1 });
    console.log(
      `fast-check: ${seeds.length} seeds, explicit seeds 1/2/3; random generator 0x11c1a5`,
    );
  }, 120_000);

  it('rotation is reversible on a clear board away from the walls', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('I', 'O', 'T', 'S', 'Z', 'J', 'L'),
        fc.integer({ min: 0, max: 3 }),
        (kind, rotation) => {
          const piece = {
            kind,
            rotation,
            x: 3,
            y: 5,
          } as Parameters<typeof cells>[0];
          const clockwise = rotate(emptyGrid(), piece, 'cw');
          expect(clockwise).not.toBeNull();
          const restored = rotate(emptyGrid(), clockwise!, 'ccw');
          expect(cells(restored!)).toEqual(cells(piece));
        },
      ),
      { seed: 11, numRuns: 1000 },
    );
  });
});
