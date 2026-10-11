import { describe, it, expect } from 'vitest';
import { gameManifestSchema } from './contract';
import { catalogPlayerRange, catalogSeats, playerCountRange } from './player-counts';

const raw = {
  id: 'mystery',
  name: 'Mystery',
  icon: '🔎',
  tagline: 'Solve it.',
  description: 'Find the solution.',
  howToPlay: ['Move.', 'Ask.', 'Solve.'],
  version: '1.0.0',
  minPlayers: 2,
  maxPlayers: 10,
  estimatedMinutes: 60,
  tags: ['classic'],
  category: 'classics',
  presence: { needs: 'anywhere' },
  addedOn: '2026-09-30',
  settings: [
    {
      key: 'edition',
      label: 'Edition',
      type: 'select',
      default: 'classic',
      options: [
        { value: 'classic', label: 'Classic' },
        { value: 'expanded', label: 'Expanded' },
      ],
    },
  ],
  playerCounts: { setting: 'edition', default: [2, 6], overrides: { expanded: [3, 10] } },
};

describe('setting-dependent roster limits', () => {
  it('resolves default, expanded and stale settings identically on engine and catalog', () => {
    const m = gameManifestSchema.parse(raw);
    const c = { minPlayers: m.minPlayers, maxPlayers: m.maxPlayers, seats: catalogSeats(m) };
    for (const [settings, range] of [
      [{}, [2, 6]],
      [{ edition: 'expanded' }, [3, 10]],
      [{ edition: 'missing' }, [2, 6]],
      [{ edition: '__proto__' }, [2, 6]],
    ] as const) {
      expect(playerCountRange(m, settings)).toEqual(range);
      expect(catalogPlayerRange(c, settings)).toEqual(range);
    }
  });
  it('preserves global ranges for existing games without an override', () => {
    const m = gameManifestSchema.parse({ ...raw, playerCounts: undefined });
    expect(playerCountRange(m, { edition: 'expanded' })).toEqual([2, 10]);
    expect(catalogSeats(m)).toBeUndefined();
    expect(catalogPlayerRange(m)).toEqual([2, 10]);
  });
  it.each([
    { setting: 'unknown', default: [2, 6], overrides: {} },
    { setting: 'edition', default: [7, 6], overrides: {} },
    { setting: 'edition', default: [1, 6], overrides: {} },
    { setting: 'edition', default: [2, 6], overrides: { expanded: [3, 11] } },
    { setting: 'edition', default: [2, 6], overrides: { unknown: [3, 10] } },
    { setting: 'edition', default: [2, 6], overrides: { classic: [3, 10] } },
  ])('rejects invalid range metadata %#', (playerCounts) => {
    expect(gameManifestSchema.safeParse({ ...raw, playerCounts }).success).toBe(false);
  });
});
