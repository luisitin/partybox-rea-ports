// Audit #5 (T-0054): the roster lookup and the name list every game wrote for itself.
import { describe, expect, it } from 'vitest';
import { playerName } from './names';
import { joinNamesIn } from './ui/joinNamesIn';

const players = [
  { id: 'p1', name: 'Ana' },
  { id: 'p2', name: 'Ben' },
];

describe('playerName', () => {
  it("finds a name, else '?' (or the given fallback)", () => {
    expect(playerName(players, 'p2')).toBe('Ben');
    expect(playerName(players, 'p9')).toBe('?');
    expect(playerName(players, null, '')).toBe('');
  });

  it("reads a state's record too, own ids only", () => {
    const record = { p1: { name: 'Ana' } };
    expect(playerName(record, 'p1')).toBe('Ana');
    expect(playerName(record, 'constructor')).toBe('?');
  });
});

describe('joinNamesIn', () => {
  it('reads "A", "A and B", "A, B and C" — and "y" in Spanish', () => {
    expect(joinNamesIn('en', [])).toBe('');
    expect(joinNamesIn('en', ['Ana'])).toBe('Ana');
    expect(joinNamesIn('en', ['Ana', 'Ben'])).toBe('Ana and Ben');
    expect(joinNamesIn('en', ['Ana', 'Ben', 'Cleo'])).toBe('Ana, Ben and Cleo');
    expect(joinNamesIn('es', ['Ana', 'Ben', 'Cleo'])).toBe('Ana, Ben y Cleo');
  });

  it('keeps an ampersand in English', () => {
    expect(joinNamesIn('en', ['Lu', 'Sam', 'Bo'], '&')).toBe('Lu, Sam & Bo');
    expect(joinNamesIn('es', ['Lu', 'Sam'], '&')).toBe('Lu y Sam');
  });
});
