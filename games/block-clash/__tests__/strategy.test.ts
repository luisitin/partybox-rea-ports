import { describe, expect, it } from 'vitest';
import { createRng } from '@partybox/game-sdk';
import type { Rng } from '@partybox/game-sdk';
import { emptyGrid } from '../server/engine';
import { fits, KINDS } from '../server/pieces';
import { placement } from '../server/strategy';
import { H, W } from '../server/types';
import type { ActivePiece, Grid, Rotation, State } from '../server/types';
import play from '../fixtures/play.json';
import score from '../fixtures/score.json';
import done from '../fixtures/done.json';
import { referencePlacement } from './strategy-reference';

const SKILLS = ['easy', 'normal', 'sharp'] as const;
const MODES = ['sparse', 'stacked', 'mixed', 'near-full'] as const;

function generatedGrid(rng: Rng, mode: (typeof MODES)[number]): Grid {
  const grid = emptyGrid();
  if (mode === 'stacked') {
    for (let x = 0; x < W; x++) {
      const height = rng.int(0, H - 2);
      for (let y = H - height; y < H; y++) {
        grid[y]![x] = rng.chance(0.9) ? rng.int(1, 8) : 0;
      }
    }
    return grid;
  }
  for (let y = 2; y < H; y++) {
    const density = mode === 'sparse' ? 0.08 : mode === 'near-full' ? 0.9 : y < 10 ? 0.2 : 0.55;
    for (let x = 0; x < W; x++) grid[y]![x] = rng.chance(density) ? rng.int(1, 8) : 0;
  }
  return grid;
}

function fitStart(grid: Grid, rng: Rng, seed: number): ActivePiece {
  const kind = KINDS[seed % KINDS.length]!;
  const rotation = (Math.floor(seed / KINDS.length) % 4) as Rotation;
  for (let attempt = 0; attempt < 24; attempt++) {
    const active = { kind, rotation, x: rng.int(-2, W - 1), y: rng.int(-2, 3) };
    if (fits(grid, active)) return active;
  }
  // Every generated grid reserves its first two rows for a legal hidden spawn.
  const active = { kind, rotation, x: 3, y: -2 };
  if (!fits(grid, active)) throw new Error(`Seed ${seed}: no fitting start`);
  return active;
}

describe('placement optimization equivalence', () => {
  it('returns the identical complete plan on 1000 seeded grids at all three strengths', () => {
    const counts = Object.fromEntries(MODES.map((mode) => [mode, 0]));
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = createRng(seed);
      const mode = MODES[(seed - 1) % MODES.length]!;
      const grid = generatedGrid(rng, mode);
      const active = fitStart(grid, rng, seed);
      expect(fits(grid, active)).toBe(true);
      const before = JSON.stringify(grid);
      for (const skill of SKILLS) {
        const salt = `${seed}:${mode}`;
        expect(
          placement(grid, active, skill, salt),
          `seed=${seed} mode=${mode} skill=${skill} piece=${JSON.stringify(active)}`,
        ).toEqual(referencePlacement(grid, active, skill, salt));
      }
      expect(JSON.stringify(grid)).toBe(before);
      counts[mode] = counts[mode]! + 1;
    }
    expect(Object.values(counts)).toEqual([250, 250, 250, 250]);
    console.log('Exact placement equivalence: 1000 grids × 3 strengths; 250 grids per profile');
  }, 120_000);

  it('matches on empty boards for every kind, initial rotation and strength', () => {
    const grid = emptyGrid();
    for (const kind of KINDS) {
      for (const rotation of [0, 1, 2, 3] as const) {
        const active = { kind, rotation, x: 3, y: -1 };
        expect(fits(grid, active)).toBe(true);
        for (const skill of SKILLS) {
          const salt = `empty:${kind}:${rotation}:${skill}`;
          expect(placement(grid, active, skill, salt)).toEqual(
            referencePlacement(grid, active, skill, salt),
          );
        }
      }
    }
  });

  it('matches the first board of every phase fixture, including hidden spawn positions', () => {
    const fixtures = [play, score, done] as unknown as State[];
    let compared = 0;
    for (const state of fixtures) {
      const grid = state.boards[0]!.grid;
      for (const kind of KINDS) {
        for (const rotation of [0, 1, 2, 3] as const) {
          const active = { kind, rotation, x: 3, y: -2 };
          if (!fits(grid, active)) continue;
          for (const skill of SKILLS) {
            const salt = `fixture:${state.phase.id}:${kind}:${rotation}:${skill}`;
            expect(placement(grid, active, skill, salt)).toEqual(
              referencePlacement(grid, active, skill, salt),
            );
            compared++;
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(0);
  });
});
