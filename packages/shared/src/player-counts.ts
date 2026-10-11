// ADR-072: pure roster limits shared by the server, picker and contract harness.
import { coerceSetting } from './settings';
import type { GameManifest, Settings } from './contract';
import type { CatalogEntry, CatalogSeats } from './protocol';

export type PlayerRange = readonly [minPlayers: number, maxPlayers: number];

export function playerCountRange(
  manifest: Pick<GameManifest, 'minPlayers' | 'maxPlayers' | 'settings' | 'playerCounts'>,
  settings: Settings = {},
): PlayerRange {
  const counts = manifest.playerCounts;
  if (!counts) return [manifest.minPlayers, manifest.maxPlayers];
  const spec = manifest.settings.find((s) => s.key === counts.setting);
  if (!spec || spec.type !== 'select') return counts.default;
  const value = String(coerceSetting(spec, settings[spec.key]));
  return Object.hasOwn(counts.overrides, value) ? counts.overrides[value]! : counts.default;
}

export function catalogSeats(manifest: GameManifest): CatalogSeats | undefined {
  const counts = manifest.playerCounts;
  const spec = manifest.settings.find((s) => s.key === counts?.setting);
  return counts && spec?.type === 'select'
    ? [counts.setting, spec.default, counts.default, counts.overrides]
    : undefined;
}

export function catalogPlayerRange(
  game: Pick<CatalogEntry, 'minPlayers' | 'maxPlayers' | 'seats'>,
  settings: Settings = {},
): PlayerRange {
  if (!game.seats) return [game.minPlayers, game.maxPlayers];
  const [key, fallback, defaultRange, overrides] = game.seats;
  const value = settings[key] ?? fallback;
  return typeof value === 'string' && Object.hasOwn(overrides, value)
    ? overrides[value]!
    : defaultRange;
}
