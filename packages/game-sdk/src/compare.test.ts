// compareCodeUnits replaced localeCompare in the pure SDK helpers and game servers (ADR-048).
// It must keep the order localeCompare gave for the ids the engine actually mints.
import { describe, expect, it } from 'vitest';
import { compareCodeUnits } from './compare';

describe('compareCodeUnits', () => {
  it('orders like a sort comparator', () => {
    expect(compareCodeUnits('a', 'b')).toBe(-1);
    expect(compareCodeUnits('b', 'a')).toBe(1);
    expect(compareCodeUnits('p1', 'p1')).toBe(0);
    expect(['p2', 'p10', 'p1'].sort(compareCodeUnits)).toEqual(['p1', 'p10', 'p2']);
  });

  it('keeps localeCompare’s order for test ids and UUIDs', () => {
    const ids = [
      ...Array.from({ length: 16 }, (_, i) => `p${i + 1}`),
      'ghost',
      'bot-1',
      'bot-12',
      'a',
      'b',
      '5f0c2a8e-1d4b-4c7e-9a2f-0b1c2d3e4f50',
      '5f0c2a8e-1d4b-4c7e-9a2f-0b1c2d3e4f5a',
      '0a1b2c3d-0000-4000-8000-000000000000',
      'e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
    ];
    expect([...ids].sort(compareCodeUnits)).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });
});
