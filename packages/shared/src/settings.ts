// One setting value coerced to its manifest spec: the rule the engine applies to every VIP edit
// (engine/src/settings.ts) and games apply at `init` (game-sdk settings helpers), so a test or an
// old room that hands a game a stale value gets what the lobby would have given it. Never throws.
// Type-only import from contract.ts: no zod reaches a browser through this file.
import { multiselectPicks } from './constants';
import type { SettingSpec, SettingValue } from './contract';

export function coerceSetting(spec: SettingSpec, raw: unknown): SettingValue {
  switch (spec.type) {
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return spec.default;
      let v = Math.min(spec.max, Math.max(spec.min, raw));
      if (spec.step) v = spec.min + Math.round((v - spec.min) / spec.step) * spec.step;
      return Math.min(spec.max, Math.max(spec.min, v));
    }
    case 'boolean':
      return typeof raw === 'boolean' ? raw : spec.default;
    case 'select':
      return typeof raw === 'string' && spec.options.some((o) => o.value === raw)
        ? raw
        : spec.default;
    case 'multiselect':
      // Unknown picks are dropped, the rest kept in option order; a non-string is the default.
      return typeof raw === 'string' ? multiselectPicks(raw, spec).join(',') : spec.default;
  }
}
