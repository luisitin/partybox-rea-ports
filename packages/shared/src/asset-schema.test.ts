import { describe, expect, it } from 'vitest';
import { assetSchema } from './asset-schema';
import { resolveAssetUrl } from './asset-url';

const definition = {
  id: 'monopoly/token-car',
  title: 'Race car',
  kind: 'model',
  status: 'draft',
  files: { master: 'car.glb' },
  source: { from: 'test', author: '', license: '', url: '' },
};
describe('library contract', () => {
  it('rejects paths, mixed-case identities, and authored usage records', () => {
    for (const id of ['Monopoly/car', '../car', 'monopoly/a/b', 'room/__proto__'])
      expect(assetSchema.safeParse({ ...definition, id }).success).toBe(false);
    for (const master of ['../car.glb', '/car.glb', 'folder/car.glb', 'a\\car.glb', 'a..glb'])
      expect(assetSchema.safeParse({ ...definition, files: { master } }).success).toBe(false);
    expect(assetSchema.safeParse({ ...definition, usedBy: [] }).success).toBe(false);
    expect(assetSchema.parse(definition).references).toEqual([]);
  });
  it('never silently chooses a heavier or an old form', () => {
    const files = { 'monopoly/token-car': { tv: { file: 'tv.glb', hash: 'abc' } } };
    expect(resolveAssetUrl(files, 'monopoly/token-car', 'tv')).toBe(
      '/lib/monopoly/token-car/tv.glb?v=abc',
    );
    expect(resolveAssetUrl(files, 'monopoly/token-car', 'tv', '/test/lib')).toBe(
      '/test/lib/monopoly/token-car/tv.glb?v=abc',
    );
    expect(() => resolveAssetUrl(files, 'monopoly/token-car', 'phone')).toThrow(
      'Missing asset form',
    );
    expect(() => resolveAssetUrl(files, 'constructor', 'tv')).toThrow('Unknown asset');
    expect(() => resolveAssetUrl(files, 'monopoly/token-car', 'constructor')).toThrow(
      'Missing asset form',
    );
  });
});
