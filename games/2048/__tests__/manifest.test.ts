import { describe, expect, it } from 'vitest';
import { gameManifestSchema } from '@partybox/game-sdk';
import manifest from '../manifest.json';

describe('official numeric game identifier', () => {
  it('loads the required 2048 ID and preserves existing letter-led IDs', () => {
    expect(gameManifestSchema.parse(manifest).id).toBe('2048');
    expect(gameManifestSchema.safeParse({ ...manifest, id: 'curve-fever' }).success).toBe(true);
  });
  it.each(['../2048', '/2048', '-2048', 'Twenty48', '2', '2'.repeat(33)])(
    'rejects unsafe or malformed ID %s',
    (id) => {
      expect(gameManifestSchema.safeParse({ ...manifest, id }).success).toBe(false);
    },
  );
});
