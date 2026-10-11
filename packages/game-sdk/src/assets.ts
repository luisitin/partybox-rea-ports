// Library links carry no media or rendering code; import a renderer only from a lazy chunk.
import { assetFiles, resolveAssetUrl } from '@partybox/shared';
import type { AssetForm, AssetId } from '@partybox/shared';

export function assetUrl(id: AssetId, form: AssetForm): string {
  return resolveAssetUrl(assetFiles, id, form);
}
