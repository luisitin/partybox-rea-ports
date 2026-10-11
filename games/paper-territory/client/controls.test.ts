import { describe, expect, it } from 'vitest';
import type { Direction } from '../server/types';
import { canSteer, clockText, directionForKey, directionRequest, DIRECTIONS } from './controls';

describe('absolute direction controls', () => {
  const active = { phaseId: 'play', paused: false, alive: true, me: { role: 'player' as const } };
  it('sends the same fixed up/right/down/left semantics for touch and keyboard', () => {
    const keys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
    expect(DIRECTIONS.map((button) => directionRequest(active, button.dir))).toEqual(
      keys.map((key) => directionRequest(active, directionForKey(key) as Direction)),
    );
    expect(DIRECTIONS.map((button) => [button.name, button.dir])).toEqual([
      ['Up', 0],
      ['Right', 1],
      ['Down', 2],
      ['Left', 3],
    ]);
    expect(['W', 'd', 'S', 'a'].map(directionForKey)).toEqual([0, 1, 2, 3]);
    expect(directionForKey('Enter')).toBeNull();
  });
  it.each(['ready', 'score', 'done'])('has no gameplay input during %s', (phaseId) => {
    expect(directionRequest({ ...active, phaseId }, 1)).toBeNull();
  });
  it('blocks paused, respawning and spectator inputs', () => {
    expect(canSteer({ ...active, paused: true })).toBe(false);
    expect(directionRequest({ ...active, alive: false }, 1)).toBeNull();
    expect(directionRequest({ ...active, me: { role: 'spectator' } }, 1)).toBeNull();
  });
});

describe('the room clock', () => {
  it('rounds up a partial second without showing negative time', () => {
    expect(clockText(120000)).toBe('2:00');
    expect(clockText(59001)).toBe('1:00');
    expect(clockText(1)).toBe('0:01');
    expect(clockText(-200)).toBe('0:00');
  });
});
