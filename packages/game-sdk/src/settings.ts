// A game's settings at `init`, read against its own manifest. The engine hands `init` settings it
// already coerced (engine/src/settings.ts); these apply the same rule (shared `coerceSetting`) so
// tests, fixtures and old rooms can never hand a game a value the lobby would not have: a number
// clamped into its range and snapped to its step, a boolean or a select option or the default.
// Pure. A key the manifest does not declare reads as 0 / false / '' / [] rather than throwing.
import { coerceSetting, multiselectPicks } from '@partybox/shared';
import type { GameManifest, SettingSpec, Settings } from '@partybox/shared';

/** Anything that carries a manifest's settings (the manifest itself, or `{ settings }` in a test). */
export type SettingsSource = Pick<GameManifest, 'settings'> &
  Partial<Pick<GameManifest, 'minigame'>>;

function specOf(manifest: SettingsSource, key: string): SettingSpec | undefined {
  return manifest.settings.find((s) => s.key === key);
}

/** Every declared setting, coerced (the engine's `coerceSettings` without a patch). */
export function readSettings(manifest: SettingsSource, raw: Settings): Settings {
  const out: Settings = {};
  for (const spec of manifest.settings) out[spec.key] = coerceSetting(spec, raw[spec.key]);
  return out;
}

export function numberSetting(manifest: SettingsSource, raw: Settings, key: string): number {
  const spec = specOf(manifest, key);
  if (spec?.type !== 'number') return 0;
  // ADR-087: a minigame's own number (`manifest.minigame.settings`) may sit below the lobby's minimum.
  const own = manifest.minigame?.settings?.[key];
  if (typeof own === 'number' && raw[key] === own) return own;
  return coerceSetting(spec, raw[key]) as number;
}

export function boolSetting(manifest: SettingsSource, raw: Settings, key: string): boolean {
  const spec = specOf(manifest, key);
  if (spec?.type !== 'boolean') return false;
  return coerceSetting(spec, raw[key]) as boolean;
}

/** A select's value: one of its options, else its default. `T` is the game's own union of them. */
export function selectSetting<T extends string = string>(
  manifest: SettingsSource,
  raw: Settings,
  key: string,
): T {
  const spec = specOf(manifest, key);
  if (spec?.type !== 'select') return '' as T;
  return coerceSetting(spec, raw[key]) as T;
}

/** A multiselect's picks, in option order (unknown ones dropped). */
export function picksSetting(manifest: SettingsSource, raw: Settings, key: string): string[] {
  const spec = specOf(manifest, key);
  if (spec?.type !== 'multiselect') return [];
  return multiselectPicks(coerceSetting(spec, raw[key]), spec);
}
