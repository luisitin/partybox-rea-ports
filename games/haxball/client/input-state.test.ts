import { describe, expect, it } from 'vitest';
import { changeSource, controlPacket, directionAt, heldVector, keyAction } from './input-state';

describe('independent held Haxball inputs', () => {
  it('combines two fingers diagonally while preserving an independent kick', () => {
    const first = changeSource({}, 'finger:1', 'up');
    const second = changeSource(first, 'finger:2', 'right');
    const third = changeSource(second, 'finger:3', 'kick');
    expect(heldVector(third)).toEqual({ dx: 1, dy: -1, kick: true });
    expect(heldVector(changeSource(third, 'finger:1', null))).toEqual({ dx: 1, dy: 0, kick: true });
    expect(first).toEqual({ 'finger:1': 'up' });
  });
  it('does not release a direction still held by another source', () => {
    const two = changeSource(changeSource({}, 'key:w', 'up'), 'finger:1', 'up');
    expect(heldVector(changeSource(two, 'key:w', null))).toEqual({ dx: 0, dy: -1, kick: false });
  });
  it('opposing directions cancel irrespective of duplicate fingers', () => {
    expect(heldVector({ a: 'up', b: 'up', c: 'down', d: 'left', e: 'right' })).toEqual({
      dx: 0,
      dy: 0,
      kick: false,
    });
  });
  it('moves a captured pointer between cells and safely neutralizes centre/outside', () => {
    expect(directionAt(5, 5, 180, 180)).toBe('up-left');
    expect(directionAt(175, 175, 180, 180)).toBe('down-right');
    expect(directionAt(90, 90, 180, 180)).toBeNull();
    expect(directionAt(180, 90, 180, 180)).toBeNull();
    expect(directionAt(-1, 90, 180, 180)).toBeNull();
    expect(directionAt(1, 1, 0, 0)).toBeNull();
  });
  it('starts above the accepted sequence after refresh and never rewinds', () => {
    expect(controlPacket(-1, 77, 100, {}).seq).toBe(78);
    expect(controlPacket(90, 77, 100, {}).seq).toBe(91);
    expect(controlPacket(90, 100, 200, {}).seq).toBe(101);
  });
  it('heartbeats retain held kick rather than sending a new rising edge', () => {
    const first = controlPacket(-1, -1, 100, { hand: 'kick' });
    const beat = controlPacket(first.seq, first.seq, 100, { hand: 'kick' });
    expect(first.kick).toBe(true);
    expect(beat).toEqual({ ...first, seq: first.seq + 1 });
    const released = controlPacket(beat.seq, beat.seq, 100, {});
    expect(released).toEqual({ type: 'control', phaseAt: 100, seq: 2, dx: 0, dy: 0, kick: false });
  });
  it('uses arrows/WASD plus a separate space kick', () => {
    expect(keyAction('W')).toBe('up');
    expect(keyAction('ArrowRight')).toBe('right');
    expect(keyAction(' ')).toBe('kick');
    expect(keyAction('X')).toBe('kick');
    expect(keyAction('q')).toBeNull();
  });
});
