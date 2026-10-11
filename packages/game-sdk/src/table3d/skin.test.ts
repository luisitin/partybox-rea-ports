import { describe, expect, it } from 'vitest';
import { skinKey } from './skin';

describe('skinKey', () => {
  it('is the same for the same paint, in any order', () => {
    const a = skinKey({ map: '/x.png', colors: { Main: '#ff5d8f', Main2: '#ffbcca' } });
    const b = skinKey({ colors: { Main2: '#ffbcca', Main: '#ff5d8f' }, map: '/x.png' });
    expect(a).toBe(b);
  });

  it('differs when the texture or a colour does', () => {
    const base = skinKey({ map: '/x.png' });
    expect(skinKey({ map: '/y.png' })).not.toBe(base);
    expect(skinKey({ map: '/x.png', colors: { Main: '#fff' } })).not.toBe(base);
    expect(skinKey({})).toBe('|');
  });
});
