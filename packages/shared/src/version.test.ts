import { describe, expect, it } from 'vitest';
import { PARTYBOX_VERSION } from './version';

describe('PARTYBOX_VERSION', () => {
  it('is semver', () => {
    expect(PARTYBOX_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
